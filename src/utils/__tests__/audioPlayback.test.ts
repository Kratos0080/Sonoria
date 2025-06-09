import { playAudioBlob, isAudioFormatSupported, getPreferredAudioFormat, AudioMemoryManager } from '../audioPlayback';
import { VoiceInteractionState } from '../../features/chat/context/VoiceContext';

// Mock HTML Audio API
class MockAudio {
    public src = '';
    public preload = '';
    public autoplay = false;
    private eventListeners: { [key: string]: EventListener[] } = {};

    addEventListener(event: string, listener: EventListener): void {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(listener);
    }

    removeEventListener(event: string, listener: EventListener): void {
        if (this.eventListeners[event]) {
            const index = this.eventListeners[event].indexOf(listener);
            if (index > -1) {
                this.eventListeners[event].splice(index, 1);
            }
        }
    }

    play(): Promise<void> {
        return Promise.resolve();
    }

    // Helper method to trigger events in tests
    triggerEvent(event: string, data?: unknown): void {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(listener => {
                const eventObject = new Event(event);
                if (data && event === 'error') {
                    // Create a proper target object with error property
                    Object.defineProperty(eventObject, 'target', {
                        value: { error: data },
                        writable: true
                    });
                }
                listener(eventObject);
            });
        }
    }

    canPlayType(type: string): string {
        if (type.includes('mp3')) return 'probably';
        if (type.includes('wav')) return 'maybe';
        return '';
    }
}

// Mock URL methods
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

Object.defineProperty(global, 'URL', {
    writable: true,
    value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
    },
});

// Mock Audio constructor
Object.defineProperty(global, 'Audio', {
    writable: true,
    value: MockAudio,
});

describe('audioPlayback utilities', () => {
    let mockAudio: MockAudio;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateObjectURL.mockReturnValue('blob:test-url');
        mockAudio = new MockAudio();
        jest.spyOn(global, 'Audio').mockImplementation(() => mockAudio as unknown as HTMLAudioElement);
    });

    afterEach(() => {
        jest.resetAllMocks();
        AudioMemoryManager.cleanup();
    });

    describe('playAudioBlob', () => {
        const mockAudioBlob = new Blob(['test audio data'], { type: 'audio/mp3' });
        const mockStateChange = jest.fn();
        const mockOnComplete = jest.fn();
        const mockOnError = jest.fn();

        beforeEach(() => {
            mockStateChange.mockClear();
            mockOnComplete.mockClear();
            mockOnError.mockClear();
        });

        it('should successfully play audio blob', async () => {
            const playPromise = playAudioBlob(mockAudioBlob, mockStateChange, mockOnComplete, mockOnError);

            // Trigger play event
            mockAudio.triggerEvent('play');
            
            // Trigger ended event
            mockAudio.triggerEvent('ended');

            await playPromise;

            expect(mockCreateObjectURL).toHaveBeenCalledWith(mockAudioBlob);
            expect(mockStateChange).toHaveBeenCalledWith(VoiceInteractionState.VOICE_AI_SPEAKING);
            expect(mockStateChange).toHaveBeenCalledWith(VoiceInteractionState.VOICE_IDLE);
            expect(mockOnComplete).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        });

        it('should handle audio playback errors', async () => {
            const playPromise = playAudioBlob(mockAudioBlob, mockStateChange, mockOnComplete, mockOnError);

            // Trigger error event
            const errorData = { message: 'Audio format not supported' };
            mockAudio.triggerEvent('error', errorData);

            await expect(playPromise).rejects.toThrow('Audio playback error');
            expect(mockStateChange).toHaveBeenCalledWith(VoiceInteractionState.VOICE_ERROR);
            expect(mockOnError).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        });

        it('should reject for invalid audio blob', async () => {
            const emptyBlob = new Blob([], { type: 'audio/mp3' });

            await expect(playAudioBlob(emptyBlob, mockStateChange, mockOnComplete, mockOnError)).rejects.toThrow('Invalid audio blob');
            expect(mockOnError).toHaveBeenCalled();
            expect(mockCreateObjectURL).not.toHaveBeenCalled();
        });

        it('should handle play promise rejection', async () => {
            jest.spyOn(mockAudio, 'play').mockRejectedValue(new Error('Play failed'));

            await expect(playAudioBlob(mockAudioBlob, mockStateChange, mockOnComplete, mockOnError)).rejects.toThrow('Failed to start audio playback');
            expect(mockStateChange).toHaveBeenCalledWith(VoiceInteractionState.VOICE_ERROR);
            expect(mockOnError).toHaveBeenCalled();
        });

        it('should handle object URL creation errors', async () => {
            mockCreateObjectURL.mockImplementation(() => {
                throw new Error('Failed to create object URL');
            });

            await expect(playAudioBlob(mockAudioBlob, mockStateChange, mockOnComplete, mockOnError)).rejects.toThrow('Audio setup error');
            expect(mockStateChange).toHaveBeenCalledWith(VoiceInteractionState.VOICE_ERROR);
            expect(mockOnError).toHaveBeenCalled();
        });

        it('should handle pause event without state change', async () => {
            const playPromise = playAudioBlob(mockAudioBlob, mockStateChange, mockOnComplete, mockOnError);

            mockAudio.triggerEvent('play');
            mockAudio.triggerEvent('pause');

            expect(mockStateChange).toHaveBeenCalledWith(VoiceInteractionState.VOICE_AI_SPEAKING);
            // Should not change state on pause
            expect(mockStateChange).not.toHaveBeenCalledWith(VoiceInteractionState.VOICE_IDLE);

            // Clean up by triggering ended
            mockAudio.triggerEvent('ended');
            await playPromise;
        });
    });

    describe('isAudioFormatSupported', () => {
        it('should return true for supported formats', () => {
            expect(isAudioFormatSupported('audio/mp3')).toBe(true);
            expect(isAudioFormatSupported('audio/wav')).toBe(true);
        });

        it('should return false for unsupported formats', () => {
            expect(isAudioFormatSupported('audio/flac')).toBe(false);
        });
    });

    describe('getPreferredAudioFormat', () => {
        it('should prefer mp3 when available', () => {
            expect(getPreferredAudioFormat()).toBe('mp3');
        });

        it('should fallback to wav when mp3 unavailable', () => {
            jest.spyOn(MockAudio.prototype, 'canPlayType').mockImplementation((type: string) => {
                if (type.includes('wav')) return 'maybe';
                return '';
            });

            expect(getPreferredAudioFormat()).toBe('wav');
        });

        it('should fallback to opus when mp3 and wav unavailable', () => {
            jest.spyOn(MockAudio.prototype, 'canPlayType').mockImplementation((type: string) => {
                if (type.includes('opus')) return 'maybe';
                return '';
            });

            expect(getPreferredAudioFormat()).toBe('opus');
        });

        it('should default to mp3 when no formats supported', () => {
            jest.spyOn(MockAudio.prototype, 'canPlayType').mockReturnValue('');

            expect(getPreferredAudioFormat()).toBe('mp3');
        });
    });

    describe('AudioMemoryManager', () => {
        it('should track and release URLs', () => {
            const testUrl = 'blob:test-url-1';
            
            AudioMemoryManager.trackUrl(testUrl);
            expect(AudioMemoryManager.getActiveUrlCount()).toBe(1);

            AudioMemoryManager.releaseUrl(testUrl);
            expect(AudioMemoryManager.getActiveUrlCount()).toBe(0);
            expect(mockRevokeObjectURL).toHaveBeenCalledWith(testUrl);
        });

        it('should handle releasing non-tracked URLs', () => {
            AudioMemoryManager.releaseUrl('non-existent-url');
            expect(mockRevokeObjectURL).not.toHaveBeenCalled();
        });

        it('should cleanup all tracked URLs', () => {
            const urls = ['blob:url-1', 'blob:url-2', 'blob:url-3'];
            
            urls.forEach(url => AudioMemoryManager.trackUrl(url));
            expect(AudioMemoryManager.getActiveUrlCount()).toBe(3);

            AudioMemoryManager.cleanup();
            expect(AudioMemoryManager.getActiveUrlCount()).toBe(0);
            expect(mockRevokeObjectURL).toHaveBeenCalledTimes(3);
        });

        it('should track multiple URLs correctly', () => {
            AudioMemoryManager.trackUrl('blob:url-1');
            AudioMemoryManager.trackUrl('blob:url-2');
            AudioMemoryManager.trackUrl('blob:url-1'); // Duplicate - should not increase count

            expect(AudioMemoryManager.getActiveUrlCount()).toBe(2);
        });
    });
}); 