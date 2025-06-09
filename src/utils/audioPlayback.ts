import { VoiceInteractionState } from '../features/chat/context/VoiceContext';

/**
 * Plays an audio blob using HTMLAudioElement with comprehensive state management and cleanup.
 * @param audioBlob The audio blob to play
 * @param onStateChange Callback to update voice interaction state
 * @param onComplete Optional callback when playback completes successfully
 * @param onError Optional callback when playback encounters an error
 * @returns Promise that resolves when playback setup is complete
 */
export async function playAudioBlob(
    audioBlob: Blob,
    onStateChange: (state: VoiceInteractionState) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!audioBlob || audioBlob.size === 0) {
            const error = new Error('Invalid audio blob provided');
            console.error('playAudioBlob: Invalid audio blob');
            onError?.(error);
            reject(error);
            return;
        }

        // Create object URL for the audio blob
        let objectUrl: string | null = null;
        let audioElement: HTMLAudioElement | null = null;

        const cleanup = () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                objectUrl = null;
            }
            if (audioElement) {
                audioElement.removeEventListener('ended', handleEnded);
                audioElement.removeEventListener('error', handleError);
                audioElement.removeEventListener('play', handlePlay);
                audioElement.removeEventListener('pause', handlePause);
                audioElement.src = '';
                audioElement = null;
            }
        };

        const handleEnded = () => {
            console.log('Audio playback completed');
            onStateChange(VoiceInteractionState.VOICE_IDLE);
            onComplete?.();
            cleanup();
        };

        const handleError = (event: Event) => {
            const audioError = (event.target as HTMLAudioElement)?.error;
            const error = new Error(`Audio playback error: ${audioError?.message || 'Unknown error'}`);
            console.error('Audio playback error:', audioError);
            onStateChange(VoiceInteractionState.VOICE_ERROR);
            onError?.(error);
            cleanup();
            reject(error);
        };

        const handlePlay = () => {
            console.log('Audio playback started');
            onStateChange(VoiceInteractionState.VOICE_AI_SPEAKING);
        };

        const handlePause = () => {
            console.log('Audio playback paused');
            // Keep speaking state during pause in case it resumes
        };

        try {
            // Create object URL and audio element
            objectUrl = URL.createObjectURL(audioBlob);
            audioElement = new Audio(objectUrl);

            // Set up event listeners
            audioElement.addEventListener('ended', handleEnded);
            audioElement.addEventListener('error', handleError);
            audioElement.addEventListener('play', handlePlay);
            audioElement.addEventListener('pause', handlePause);

            // Configure audio element
            audioElement.preload = 'auto';
            audioElement.autoplay = false;

            console.log('Starting audio playback:', {
                blobSize: audioBlob.size,
                blobType: audioBlob.type,
                objectUrl: objectUrl
            });

            // Start playback
            const playPromise = audioElement.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('Audio play promise resolved');
                        resolve();
                    })
                    .catch((error) => {
                        console.error('Audio play promise rejected:', error);
                        const playError = new Error(`Failed to start audio playback: ${error.message}`);
                        onStateChange(VoiceInteractionState.VOICE_ERROR);
                        onError?.(playError);
                        cleanup();
                        reject(playError);
                    });
            } else {
                // Older browsers might not return a promise
                resolve();
            }

        } catch (error) {
            console.error('Error setting up audio playback:', error);
            const setupError = new Error(`Audio setup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            onStateChange(VoiceInteractionState.VOICE_ERROR);
            onError?.(setupError);
            cleanup();
            reject(setupError);
        }
    });
}

/**
 * Checks if the browser supports audio playback for the given MIME type.
 * @param mimeType The MIME type to check (e.g., 'audio/mp3', 'audio/wav')
 * @returns boolean indicating if the format is supported
 */
export function isAudioFormatSupported(mimeType: string): boolean {
    const audio = new Audio();
    const canPlay = audio.canPlayType(mimeType);
    return canPlay === 'probably' || canPlay === 'maybe';
}

/**
 * Gets the preferred audio format based on browser support.
 * @returns The preferred audio format string
 */
export function getPreferredAudioFormat(): 'mp3' | 'wav' | 'opus' {
    if (isAudioFormatSupported('audio/mp3')) {
        return 'mp3';
    } else if (isAudioFormatSupported('audio/wav')) {
        return 'wav';
    } else if (isAudioFormatSupported('audio/ogg; codecs=opus')) {
        return 'opus';
    }
    // Default to mp3 as it has the widest support
    return 'mp3';
}

/**
 * Audio memory management utility to track and cleanup audio resources.
 */
export class AudioMemoryManager {
    private static activeUrls = new Set<string>();

    static trackUrl(url: string): void {
        this.activeUrls.add(url);
    }

    static releaseUrl(url: string): void {
        if (this.activeUrls.has(url)) {
            URL.revokeObjectURL(url);
            this.activeUrls.delete(url);
        }
    }

    static cleanup(): void {
        this.activeUrls.forEach(url => {
            URL.revokeObjectURL(url);
        });
        this.activeUrls.clear();
    }

    static getActiveUrlCount(): number {
        return this.activeUrls.size;
    }
} 