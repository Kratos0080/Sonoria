import { OpenAIService } from '../OpenAIService';
import type { NoteChatSettings } from '@app/settings';

// Mock console methods to avoid noise in test output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'time').mockImplementation(() => {});
jest.spyOn(console, 'timeEnd').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('OpenAIService', () => {
    let openAIService: OpenAIService;
    let mockSettings: NoteChatSettings;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock settings
        mockSettings = {
            openAiApiKey: 'test-api-key',
            llmModel: 'gpt-4o',
            conversationHistoryDirectory: '/NoteChat Conversations',
            noteFolderPath: '',
        } as NoteChatSettings;

        // Create service instance
        openAIService = new OpenAIService(mockSettings);

        // Mock fetch globally
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('textToSpeech', () => {
        const mockTextInput = 'Hello, this is a test message for text-to-speech conversion.';
        const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/mp3' });

        it('should successfully convert text to speech', async () => {
            const mockResponse = new Response(mockAudioBlob, {
                status: 200,
                statusText: 'OK'
            });
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeInstanceOf(Blob);
            expect(result?.size).toBeGreaterThan(0);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/audio/speech',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${mockSettings.openAiApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini-tts',
                        input: mockTextInput,
                        voice: 'alloy',
                        response_format: 'mp3',
                        speed: 1.0
                    })
                })
            );
        });

        it('should handle custom TTS options', async () => {
            const mockResponse = new Response(mockAudioBlob, {
                status: 200,
                statusText: 'OK'
            });
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const customOptions = {
                voice: 'nova' as const,
                format: 'wav' as const,
                speed: 1.2,
                instructions: 'Speak with enthusiasm'
            };

            const result = await openAIService.textToSpeech(mockTextInput, customOptions);

            expect(result).toBeInstanceOf(Blob);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/audio/speech',
                expect.objectContaining({
                    body: JSON.stringify({
                        model: 'gpt-4o-mini-tts',
                        input: mockTextInput,
                        voice: 'nova',
                        response_format: 'wav',
                        speed: 1.2,
                        instructions: 'Speak with enthusiasm'
                    })
                })
            );
        });

        it('should return null when API key is not configured', async () => {
            const serviceWithoutKey = new OpenAIService({
                ...mockSettings,
                openAiApiKey: ''
            });

            const result = await serviceWithoutKey.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should return null when text input is empty', async () => {
            const result = await openAIService.textToSpeech('');
            expect(result).toBeNull();

            const result2 = await openAIService.textToSpeech('   ');
            expect(result2).toBeNull();

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should handle 401 authentication error', async () => {
            const mockErrorResponse = new Response(
                JSON.stringify({ error: { message: 'Invalid API key' } }),
                { status: 401, statusText: 'Unauthorized' }
            );
            (global.fetch as jest.Mock).mockResolvedValue(mockErrorResponse);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('OpenAI Authentication Error')
            );
        });

        it('should handle 429 rate limit error', async () => {
            const mockErrorResponse = new Response(
                JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
                { status: 429, statusText: 'Too Many Requests' }
            );
            (global.fetch as jest.Mock).mockResolvedValue(mockErrorResponse);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('OpenAI Rate Limit Exceeded')
            );
        });

        it('should handle 400 bad request error', async () => {
            const mockErrorResponse = new Response(
                JSON.stringify({ error: { message: 'Invalid voice parameter' } }),
                { status: 400, statusText: 'Bad Request' }
            );
            (global.fetch as jest.Mock).mockResolvedValue(mockErrorResponse);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('OpenAI TTS API Bad Request')
            );
        });

        it('should handle non-JSON error response', async () => {
            const mockErrorResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
                text: jest.fn().mockResolvedValue('Internal Server Error')
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockErrorResponse);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('OpenAI TTS API Error (500)')
            );
        });

        it('should handle empty audio blob response', async () => {
            const emptyBlob = new Blob([], { type: 'audio/mp3' });
            const mockResponse = new Response(emptyBlob, {
                status: 200,
                statusText: 'OK'
            });
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                'Received empty audio blob from TTS API'
            );
        });

        it('should handle network/fetch errors', async () => {
            const networkError = new Error('Network error');
            (global.fetch as jest.Mock).mockRejectedValue(networkError);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                'Error during text-to-speech conversion:',
                networkError
            );
        });

        it('should handle blob conversion errors', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                blob: jest.fn().mockRejectedValue(new Error('Blob conversion failed'))
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await openAIService.textToSpeech(mockTextInput);

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                'Error during text-to-speech conversion:',
                expect.any(Error)
            );
        });
    });
}); 