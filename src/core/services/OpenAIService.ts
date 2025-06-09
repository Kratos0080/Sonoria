import 'openai/shims/web'; // THIS MUST BE THE FIRST OPENAI IMPORT
import { VectorStores } from 'openai/resources/vector-stores/vector-stores'; // Side-effect import for tree-shaking
console.log(typeof VectorStores); // Restore to satisfy TS6133 and ensure side-effect
import OpenAI from 'openai';
import type { NoteChatSettings } from '@app/settings';
import { removeCitationAnnotations } from '../../utils/textUtils';
// import { Notice } from 'obsidian'; // Removed unused import

// Define VOICE_PROCESSING_STT state type if not already defined globally
// Assuming VoiceState is defined in 'src/core/types/index.ts' or similar
// import { VoiceState } from '../types';

// Export for testing purposes
export const PRESET_ASSISTANT_ID = 'asst_oPHViKRn9BzTPCEP5TAzFIIP'; // Updated as per plan
// const POLLING_INTERVAL_MS = 1000; // 1 second // REMOVED
// const MAX_POLLING_ATTEMPTS = 30; // Max 30 attempts (e.g., 30 seconds) // REMOVED

export class OpenAIServiceError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'OpenAIServiceError';
  }
}

export class OpenAIService {
    private client: OpenAI | null = null; // Proper OpenAI type instead of any
    private apiKey: string | null = null;
    private readonly presetAssistantId: string; // Store the injected ID
    // File upload cache: content hash -> file ID
    private fileCache = new Map<string, string>();

    constructor(private settings: NoteChatSettings) { // Removed plugin parameter
        this.presetAssistantId = process.env.PRESET_ASSISTANT_ID || '';
        if (this.settings.openAiApiKey) {
            this.apiKey = this.settings.openAiApiKey;
            try {
                // When using `import * as OpenAI`, the constructor is OpenAI.default
                // However, the openai v4 library is designed for `import OpenAI from 'openai'`
                // Let's assume the default import IS working and the issue is namespace resolution.
                // The previous read_file showed `import OpenAI from 'openai';` was at the top.
                // Sticking with the direct new OpenAI for now, assuming the import is okay and TS config is the issue.
                const clientOptions = {
                    apiKey: this.apiKey,
                    dangerouslyAllowBrowser: true,
                    defaultHeaders: { 'OpenAI-Beta': 'assistants=v2' }
                } as ConstructorParameters<typeof OpenAI>[0];
                this.client = new OpenAI(clientOptions);

            } catch (_error) {
                // console.error('NoteChat OpenAIService: Error initializing OpenAI client:', error); // Permanently commented out
                this.client = null;
            }
        } else {
            // console.warn('NoteChat OpenAIService: OpenAI API key not set. OpenAI Service client will not be available.'); // Permanently commented out
            this.client = null; 
        }

        // SDK VERIFICATION LOGS REMOVED
    }

    isAvailable(): boolean { // This method seems less relevant now with specific checks, but kept for now
        return !!this.client;
    }

    public isAssistantConfigured(): boolean {
        const hasApiKey = !!this.apiKey;
        const hasValidAssistantId = !!this.presetAssistantId && this.presetAssistantId.startsWith('asst_');
        
        const configured = hasApiKey && hasValidAssistantId;
        
        // LOGS FOR MISCONFIGURATION REMOVED
        return configured;
    }

    public getApiKey(): string | null {
        return this.apiKey;
    }

    /**
     * Transcribes the given audio blob using the OpenAI STT API.
     * @param audioBlob The audio data to transcribe.
     * @returns A promise that resolves with the transcription text or null if an error occurs or the service is unavailable.
     */
    async transcribeAudio(audioBlob: Blob): Promise<string | null> {
        console.time("OpenAIService_transcribeAudio");
        try {
        if (!this.apiKey) {
            // console.error('OpenAI API key is not configured. Cannot transcribe audio.'); // Permanently commented out
            return null;
        }
        if (!audioBlob || audioBlob.size === 0) {
            // console.error('Audio blob is empty or invalid.'); // Permanently commented out
            return null;
        }
        // console.log(`Transcribing audio blob via manual fetch: Size=${audioBlob.size} bytes, Type=${audioBlob.type}`); // Permanently commented out

        const formData = new FormData();
        // IMPORTANT: Provide a filename with the correct extension for the API
        formData.append('file', audioBlob, 'audio.webm'); 
        formData.append('model', 'gpt-4o-mini-transcribe');
        // 🎯 VOICE QUALITY IMPROVEMENT: Auto-language detection + deterministic transcription
        // formData.append('language', 'en'); // REMOVED: Let Whisper auto-detect language for global users
        formData.append('temperature', '0.0'); // Add deterministic transcription for better accuracy
        // formData.append('response_format', 'json'); // API default is JSON

        const apiUrl = 'https://api.openai.com/v1/audio/transcriptions';

            // console.log('Sending manual fetch request to OpenAI STT API...'); // Permanently commented out
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    // 'Content-Type': 'multipart/form-data' // Usually set automatically by fetch with FormData
                },
                body: formData,
            });

            // console.log('Received response from manual fetch:', response.status, response.statusText); // Permanently commented out

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json(); 
                    // console.error('OpenAI API Error Response:', errorData); // Permanently commented out
                } catch (_error) {
                    errorData = { message: await response.text() }; 
                    // console.error('OpenAI API Error Response (non-JSON):', errorData.message); // Permanently commented out
                }
                
                let errorMessage = `OpenAI API Error (${response.status}): ${errorData?.error?.message || response.statusText || 'Unknown error'}`;
                 if (response.status === 401) {
                    errorMessage = 'OpenAI Authentication Error. Please check your API key.';
                } else if (response.status === 429) {
                    errorMessage = 'OpenAI Rate Limit Exceeded. Please try again later.';
                } else if (response.status === 400) {
                    errorMessage = `OpenAI API Bad Request (${response.status}): ${errorData?.error?.message || 'Check request parameters.'}`;
                }
                console.error(errorMessage); // Restore basic error logging for this path
                return null;
            }

            const transcription = await response.json();
            // console.log('Transcription received (manual fetch):', transcription); // Permanently commented out

            if (transcription && transcription.text) {
                return transcription.text;
            } else {
                // console.error('Transcription response format invalid (manual fetch):', transcription); // Permanently commented out
                return null;
            }

        } catch (_error) {
            // console.error('Error during transcription:', _error); // Permanently commented out
            return null;
        } finally {
            console.timeEnd("OpenAIService_transcribeAudio");
        }
    }

    public async getAssistantResponse(
        userInput: string,
        vectorStoreId?: string | null,
        onChunk?: (textChunk: string, isFinalChunk: boolean, responseId?: string | null, error?: string | null) => void,
        abortSignal?: AbortSignal
    ): Promise<{ responseId: string | null, responseText: string | null, error?: string }> {
        const timerLabel = "OpenAIService_getAssistantResponse_FullCall";
        console.time(timerLabel);
        let accumulatedText = "";
        let operationError: string | null = null;
        let runIdFromStream: string | null = null;

        // 🔧 TIMER FIX: Helper function to ensure timer is always ended
        const safeResolve = (result: { responseId: string | null, responseText: string | null, error?: string }) => {
            console.timeEnd(timerLabel);
            return result;
        };

        const internalOnChunk = (textChunk: string, isFinalChunk: boolean, error?: string | null) => {
            if (error) {
                operationError = error;
            }
            if (textChunk) {
                accumulatedText += textChunk;
            }
            if (onChunk) {
                // Always call external onChunk when provided
                onChunk(textChunk, isFinalChunk, runIdFromStream, error);
            }
        };

        try {
            // Check for cancellation before starting
            if (abortSignal?.aborted) {
                const errorMessage = "Request was cancelled before starting.";
                internalOnChunk("", true, errorMessage);
                return safeResolve({ responseId: null, responseText: null, error: errorMessage });
            }
            
            if (!this.isAssistantConfigured()) {
                const errorMessage = "OpenAIService: Assistant not configured (API Key or valid Assistant ID).";
                internalOnChunk("", true, errorMessage);
                return safeResolve({ responseId: null, responseText: null, error: errorMessage });
            }
            if (!this.client) {
                const errorMessage = "OpenAIService: OpenAI client not initialized.";
                internalOnChunk("", true, errorMessage);
                return safeResolve({ responseId: null, responseText: null, error: errorMessage });
            }

            console.log('[OpenAIService.getAssistantResponse SDK] Creating thread with vector store:', vectorStoreId);

            // Step 1: Create thread with vector store
            interface ThreadCreateParams {
                messages: Array<{
                    role: 'user' | 'assistant';
                    content: string;
                }>;
                tool_resources?: {
                    file_search?: {
                        vector_store_ids: string[];
                    };
                };
            }

            // Generate current timestamp for AI awareness
            const currentTimestamp = new Date().toISOString();
            console.log('[OpenAIService.getAssistantResponse] Including timestamp in request:', currentTimestamp);
            
            // Include timestamp in user message since Assistants API doesn't support system messages
            const timestampedUserInput = `[System Note: Current date and time: ${currentTimestamp}]\n\n${userInput}`;
            
            const threadCreateParams: ThreadCreateParams = {
                messages: [
                    {
                        role: 'user',
                        content: timestampedUserInput
                    }
                ]
            };

            if (vectorStoreId) {
                threadCreateParams.tool_resources = {
                    file_search: {
                        vector_store_ids: [vectorStoreId]
                    }
                };
            }

            console.log('[OpenAIService.getAssistantResponse SDK] Thread creation params:', JSON.stringify(threadCreateParams, null, 2));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion
            const thread = await (this.client! as any).beta.threads.create(threadCreateParams);
            console.log('[OpenAIService.getAssistantResponse SDK] Thread created:', thread.id);

            // Step 2: Check assistant configuration before creating run
            console.log('[OpenAIService.getAssistantResponse SDK] Checking assistant configuration...');
            try {
                const assistantConfig = await this.getAssistantConfiguration();
                const tools = assistantConfig?.tools as Array<{ type: string }> | undefined;
                console.log('[OpenAIService.getAssistantResponse SDK] Assistant tools:', tools?.map((t: { type: string }) => t.type) || 'None');
                console.log('[OpenAIService.getAssistantResponse SDK] Assistant model:', assistantConfig?.model || 'Unknown');
            } catch (configError) {
                console.warn('[OpenAIService.getAssistantResponse SDK] Could not check assistant config:', configError);
            }

            // Step 3: Create streaming run using the official SDK
            console.log('[OpenAIService.getAssistantResponse SDK] Creating streaming run with assistant:', this.presetAssistantId);
            
            const runParams = {
                assistant_id: this.presetAssistantId,
                // Try without additional_instructions first - this might be causing the server error
                // additional_instructions: "After using file_search to find relevant information, you MUST generate a comprehensive response to the user's question based on the search results. Always provide a helpful answer."
            };
            
            console.log('[OpenAIService.getAssistantResponse SDK] Run params:', JSON.stringify(runParams, null, 2));
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let stream: any;
            const maxRetries = 2;
            let attempt = 0;
            
            // Try creating the stream with retry logic for server errors
            while (attempt < maxRetries) {
                try {
                    attempt++;
                    console.log(`[OpenAIService.getAssistantResponse SDK] Creating stream attempt ${attempt}/${maxRetries}`);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion
                    stream = (this.client! as any).beta.threads.runs.createAndStream(thread.id, runParams);
                    break; // Success, exit retry loop
                } catch (streamCreationError: unknown) {
                    const error = streamCreationError as Error;
                    console.error(`[OpenAIService.getAssistantResponse SDK] Stream creation attempt ${attempt} failed:`, error);
                    
                    if (attempt >= maxRetries) {
                        const errorMessage = `Failed to create stream after ${maxRetries} attempts: ${error.message}`;
                        internalOnChunk("", true, errorMessage);
                        return safeResolve({ responseId: null, responseText: null, error: errorMessage });
                    }
                    
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
            
            if (!stream) {
                const errorMessage = "Failed to create stream after all retry attempts";
                internalOnChunk("", true, errorMessage);
                return safeResolve({ responseId: null, responseText: null, error: errorMessage });
            }

            // Step 4: Handle streaming events using the official SDK event handlers
            return new Promise((resolve) => {
                // Set up abort signal listener if provided
                let isAborted = false;
                const abortListener = () => {
                    isAborted = true;
                    console.log('[OpenAIService.getAssistantResponse] Request aborted by user');
                                            const errorMessage = "Request was cancelled by user.";
                        internalOnChunk("", true, errorMessage);
                        resolve(safeResolve({ responseId: runIdFromStream, responseText: null, error: errorMessage }));
                };
                
                if (abortSignal) {
                    if (abortSignal.aborted) {
                        abortListener();
                        return;
                    }
                    abortSignal.addEventListener('abort', abortListener);
                }
                stream
                    .on('textCreated', () => {
                        console.log('[OpenAIService SDK STREAM] Text creation started');
                    })
                    .on('textDelta', (textDelta: { value?: string }) => {
                        if (isAborted) return; // Skip processing if aborted
                        console.log('[OpenAIService SDK STREAM] Text delta:', textDelta.value);
                        if (textDelta.value) {
                            // 🔧 CITATION CLEANUP: Remove OpenAI citation annotations before processing
                            const cleanedTextChunk = removeCitationAnnotations(textDelta.value);
                            internalOnChunk(cleanedTextChunk, false, null);
                        }
                    })
                    .on('textDone', (text: { value?: string }) => {
                        console.log('[OpenAIService SDK STREAM] Text completed:', text.value?.length || 0, 'characters');
                    })
                    .on('toolCallCreated', (toolCall: { type: string }) => {
                        console.log('[OpenAIService SDK STREAM] Tool call created:', toolCall.type);
                    })
                    .on('toolCallDone', (toolCall: { type: string }) => {
                        console.log('[OpenAIService SDK STREAM] Tool call completed:', toolCall.type);
                    })
                    .on('runStepCreated', (runStep: { type: string }) => {
                        console.log('[OpenAIService SDK STREAM] Run step created:', runStep.type);
                    })
                    .on('runStepDone', (runStep: { type: string; status: string }) => {
                        console.log('[OpenAIService SDK STREAM] Run step completed:', runStep.type, runStep.status);
                    })
                    .on('messageDone', (message: { id: string }) => {
                        console.log('[OpenAIService SDK STREAM] Message completed:', message.id);
                    })
                    .on('runCompleted', (run: { id: string }) => {
                        if (isAborted) return; // Skip processing if aborted
                        console.log('[OpenAIService SDK STREAM] Run completed successfully:', run.id);
                        runIdFromStream = run.id;
                        // Clean up abort listener
                        if (abortSignal) {
                            abortSignal.removeEventListener('abort', abortListener);
                        }
                        internalOnChunk("", true, null);
                        // Always return the accumulated text regardless of whether streaming callback is used
                        resolve(safeResolve({ responseId: runIdFromStream, responseText: accumulatedText, error: operationError || undefined }));
                    })
                    .on('runFailed', (run: { id: string; last_error?: { message?: string } }) => {
                        if (isAborted) return; // Skip processing if aborted
                        console.error('[OpenAIService SDK STREAM] Run failed:', run.last_error);
                        // Clean up abort listener
                        if (abortSignal) {
                            abortSignal.removeEventListener('abort', abortListener);
                        }
                        const runError = run.last_error?.message || 'Run failed';
                        internalOnChunk("", true, runError);
                        resolve(safeResolve({ responseId: run.id, responseText: null, error: runError }));
                    })
                    .on('error', (error: Error) => {
                        if (isAborted) return; // Skip processing if aborted
                        console.error('[OpenAIService SDK STREAM] Stream error:', error);
                        // Clean up abort listener
                        if (abortSignal) {
                            abortSignal.removeEventListener('abort', abortListener);
                        }
                        const errorMessage = error.message || 'Stream error occurred';
                        internalOnChunk("", true, errorMessage);
                        resolve(safeResolve({ responseId: runIdFromStream, responseText: null, error: errorMessage }));
                    })
                    .on('end', () => {
                        if (isAborted) return; // Skip processing if aborted
                        console.log('[OpenAIService SDK STREAM] Stream ended');
                        // Clean up abort listener
                        if (abortSignal) {
                            abortSignal.removeEventListener('abort', abortListener);
                        }
                        // Only resolve here if we haven't already resolved from runCompleted/runFailed
                        if (accumulatedText.length > 0) {
                            console.log('[OpenAIService SDK STREAM] Stream ended with accumulated text');
                            internalOnChunk("", true, null);
                            // Always return the accumulated text regardless of whether streaming callback is used
                            resolve(safeResolve({ responseId: runIdFromStream, responseText: accumulatedText, error: operationError || undefined }));
                        } else {
                            console.log('[OpenAIService SDK STREAM] Stream ended without text - may indicate configuration issue');
                            const streamEndError = operationError || "Stream ended without generating response text. This may indicate an assistant configuration issue.";
                            internalOnChunk("", true, streamEndError);
                            resolve(safeResolve({ responseId: runIdFromStream, responseText: null, error: streamEndError }));
                        }
                    });
            });

        } catch (error: unknown) {
            console.error('OpenAIService.getAssistantResponse (SDK): Error:', error);
            let errorMessage = 'Unexpected error during assistant run.';
            if (error instanceof Error) {
                errorMessage = `OpenAIService (SDK) Error: ${error.message}`;
            }
            internalOnChunk("", true, errorMessage);
            return safeResolve({ responseId: runIdFromStream, responseText: null, error: errorMessage });
        }
    }

    // The following methods are kept as they are not directly related to the old Thread/Run assistant flow or are utilities
    // (e.g., getApiKey, transcribeAudio, checkRunStatus - though checkRunStatus might be removed if not used by anything else after this refactor)
    // public async getAssistantLatestMessage(threadId: string): Promise<any | null> { ... } // This should be removed as it's part of the old flow.
    // public async checkRunStatus(threadId: string, runId: string): Promise<any | null> { ... } // This is also part of the old flow.

    // Ensure any other methods related to the old beta.threads, beta.threads.messages, beta.threads.runs are removed.
    // Looking at the file outline, `getAssistantLatestMessage` and `checkRunStatus` are the remaining ones from the old flow.

    // Add vector store management methods for file search integration
    public async createVectorStore(name: string = "NoteChat Session Store"): Promise<string | null> {
        console.time("OpenAIService_createVectorStore");
        try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!this.client || !(this.client as any).vectorStores || typeof (this.client as any).vectorStores.create !== 'function') {
            // console.error('OpenAIService.createVectorStore: OpenAI client or vectorStores.create function is not available or not correctly initialized.'); // Permanently commented out
            // console.error(`OpenAIService.createVectorStore: Client: ${this.client}, VectorStores: ${(this.client as any)?.vectorStores}, Create: ${typeof (this.client as any)?.vectorStores?.create}`); // Permanently commented out
            return null;
        }
            // console.log('OpenAIService.createVectorStore: Attempting to create vector store with name:', name); // Permanently commented out
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vectorStore = await (this.client as any).vectorStores.create({ name });
            // console.log('OpenAIService.createVectorStore: Vector store created successfully:', vectorStore.id); // Permanently commented out
            return vectorStore.id;
        } catch (_error) {
            // console.error('OpenAIService.createVectorStore: Error creating vector store:', error); // Permanently commented out
            return null;
        } finally {
            console.timeEnd("OpenAIService_createVectorStore");
        }
    }

    public async deleteVectorStore(vectorStoreId: string): Promise<boolean> {
        // DIAGNOSTIC LOGS REMOVED

        if (!this.isAssistantConfigured()) {
            // console.error('OpenAIService.deleteVectorStore: Assistant not configured.'); // Permanently commented out
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!this.client || !(this.client as any).vectorStores) {
            // console.error('OpenAIService.deleteVectorStore: Client or vectorStores not available.'); // Permanently commented out
            return false;
        }
        console.log(`OpenAIService: Attempting to delete Vector Store [${vectorStoreId}].`);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (this.client as any).vectorStores.del(vectorStoreId);
            if (response && response.deleted) {
                console.log(`OpenAIService: Successfully deleted Vector Store ID [${vectorStoreId}]. API Response:`, response);
                return true;
            } else {
                console.warn(`OpenAIService: Deletion of Vector Store ID [${vectorStoreId}] not confirmed or failed. API Response:`, response);
                return false;
            }
        } catch (_error: unknown) {
            const error = _error as Error;
            console.error(`OpenAIService: Error deleting vector store ID ${vectorStoreId}:`, error.message || error, error);
            return false;
        }
    }

    /**
     * Uploads note content as a file for assistant vector search.
     * @param content The file content.
     * @param fileName The name to assign to the file.
     * @returns The created file ID or null on failure.
     */
    public async uploadNoteAsFile(content: string, fileName: string): Promise<string | null> {
        console.time(`OpenAIService_uploadNoteAsFile_${fileName}`);
        try {
        if (!this.isAssistantConfigured() || !this.client) {
            return null;
        }
            // console.log(`OpenAIService.uploadNoteAsFile: Uploading content for "${fileName}"`); // Permanently commented out
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fileObject = await (this.client as any).files.create({
                file: new File([content], fileName, { type: 'text/plain' }),
                purpose: 'assistants',
            });
            
            // console.log(`OpenAIService.uploadNoteAsFile: File "${fileName}" uploaded successfully with ID: ${fileObject.id}`); // Permanently commented out
            return fileObject.id;
        } catch (_error) {
            // console.error(`OpenAIService.uploadNoteAsFile: Error uploading file "${fileName}":`, error); // Permanently commented out
            return null;
        } finally {
            console.timeEnd(`OpenAIService_uploadNoteAsFile_${fileName}`);
        }
    }

    /**
     * Get cached file ID or upload file content.
     * Uses content hash for intelligent caching of frequently used files.
     * @param content The file content to upload
     * @param fileName The file name (for logging and organization)
     * @returns The file ID (cached or newly uploaded) or null on failure
     */
    public async getOrUploadFile(content: string, fileName: string): Promise<string | null> {
        const timerLabel = `OpenAIService_getOrUploadFile_${fileName}`;
        console.time(timerLabel);
        
        try {
            // Generate content hash for caching
            const contentHash = await this.hashContent(content);
            const cacheKey = `${contentHash}_${fileName}`;
            
            // Check if we already have this file cached
            if (this.fileCache.has(cacheKey)) {
                console.log(`OpenAIService.getOrUploadFile: Using cached file for "${fileName}" (hash: ${contentHash})`);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const cachedFileId = this.fileCache.get(cacheKey)!;
                console.timeEnd(timerLabel);
                return cachedFileId;
            }
            
            // File not in cache, upload it
            console.log(`OpenAIService.getOrUploadFile: File "${fileName}" not in cache, uploading (hash: ${contentHash})`);
            const fileId = await this.uploadNoteAsFile(content, fileName);
            
            if (fileId) {
                // Cache the successful upload
                this.fileCache.set(cacheKey, fileId);
                console.log(`OpenAIService.getOrUploadFile: Cached file "${fileName}" with ID: ${fileId}`);
            }
            
            console.timeEnd(timerLabel);
            return fileId;
        } catch (error) {
            console.error(`OpenAIService.getOrUploadFile: Error with file "${fileName}":`, error);
            console.timeEnd(timerLabel);
            return null;
        }
    }

    /**
     * Add an uploaded file to a vector store.
     * @param vectorStoreId The vector store ID
     * @param fileId The file ID to add
     * @param pollUntilIndexed Whether to poll until file status is 'completed'.
     * @returns True on success, false on failure.
     */
    public async addFileToVectorStore(
        vectorStoreId: string,
        fileId: string,
        pollUntilIndexed: boolean = false
    ): Promise<boolean> {
        console.time(`OpenAIService_addFileToVectorStore_${fileId}`);
        const pollTimerLabel = `OpenAIService_FileIndexingPoll_${fileId}`;
        let attempts = 0;
        try {
        if (!this.client || !vectorStoreId || !fileId) {
                console.error('OpenAIService.addFileToVectorStore: Client not initialized or missing IDs.');
            return false;
        }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (this.client as any).vectorStores.files.create(vectorStoreId, { file_id: fileId });
            // console.log(`OpenAIService.addFileToVectorStore: File ${fileId} association with ${vectorStoreId} initiated.`); // Permanently commented out

            if (pollUntilIndexed) {
                console.log(`OpenAIService.addFileToVectorStore: Polling explicitly enabled for file ${fileId} in vector store ${vectorStoreId}.`);
                console.time(pollTimerLabel);
                const maxAttempts = 30;
                const pollingInterval = 1000;

                while (attempts < maxAttempts) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const vectorStoreFile = await (this.client as any).vectorStores.files.retrieve(vectorStoreId, fileId);
                        if (vectorStoreFile?.status === 'completed') {
                            console.log(`OpenAIService.addFileToVectorStore: File ${fileId} indexed successfully (explicit polling).`);
                            console.timeEnd(pollTimerLabel);
                            return true;
                        }
                        if (vectorStoreFile?.status === 'failed' || vectorStoreFile?.status === 'cancelled') {
                            console.error(`OpenAIService.addFileToVectorStore: File ${fileId} indexing failed or was cancelled (explicit polling). Status: ${vectorStoreFile.status}`);
                            console.timeEnd(pollTimerLabel);
                            return false;
                        }
                    } catch (retrievalError) {
                        console.warn(`OpenAIService.addFileToVectorStore: Error during polling retrieve for ${fileId}, attempt ${attempts + 1}:`, retrievalError);
                    }
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                }
                console.warn(`OpenAIService.addFileToVectorStore: File ${fileId} did not complete indexing after ${maxAttempts} attempts (explicit polling).`);
                console.timeEnd(pollTimerLabel);
                return false;
            } else {
                console.log(`OpenAIService.addFileToVectorStore: Polling not enabled for file ${fileId} in vector store ${vectorStoreId}.`);
                return true;
            }
        } catch (error) {
            console.error(`OpenAIService.addFileToVectorStore: Error adding file ${fileId} to vector store ${vectorStoreId}:`, error);
            
            // 🔧 CACHE INVALIDATION: If file not found (404), invalidate cache entries for this file
            if (error instanceof Error && error.message.includes('404') && error.message.includes('not found')) {
                console.warn(`OpenAIService.addFileToVectorStore: File ${fileId} not found on server, invalidating cache entries`);
                this.invalidateCacheForFileId(fileId);
            }
            
            return false;
        } finally {
            console.timeEnd(`OpenAIService_addFileToVectorStore_${fileId}`);
        }
    }

    /**
     * Invalidate cache entries that reference a specific file ID
     * @param fileId The file ID to remove from cache
     */
    private invalidateCacheForFileId(fileId: string): void {
        const keysToRemove: string[] = [];
        
        for (const [cacheKey, cachedFileId] of this.fileCache.entries()) {
            if (cachedFileId === fileId) {
                keysToRemove.push(cacheKey);
            }
        }
        
        keysToRemove.forEach(key => {
            this.fileCache.delete(key);
            console.log(`OpenAIService: Invalidated cache entry for key: ${key}`);
        });
    }

    /**
     * Removes a file from a vector store.
     * @param vectorStoreId The vector store ID.
     * @param fileId The file ID to remove.
     * @returns True on success, false on failure.
     */
    public async removeFileFromVectorStore(vectorStoreId: string, fileId: string): Promise<boolean> {
        console.time(`OpenAIService_removeFileFromVectorStore_${fileId}`);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!this.client || !(this.client as any).vectorStores || !(this.client as any).vectorStores.files || typeof (this.client as any).vectorStores.files.del !== 'function') {
                console.error('OpenAIService.removeFileFromVectorStore: Client or vectorStores.files.del function is not available.');
                return false;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (this.client as any).vectorStores.files.del(vectorStoreId, fileId);
            return true;
        } catch (_error: unknown) {
            const error = _error as Error;
            console.error(`OpenAIService: Error removing file ${fileId} from vector store ${vectorStoreId}:`, error.message || error);
            return false;
        } finally {
            console.timeEnd(`OpenAIService_removeFileFromVectorStore_${fileId}`);
        }
    }

    /**
     * Deletes an uploaded file from the OpenAI files endpoint.
     * @param fileId The file ID to delete.
     * @returns True on success, false on failure.
     */
    public async deleteUploadedFile(fileId: string): Promise<boolean> {
        console.time(`OpenAIService_deleteUploadedFile_${fileId}`);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!this.client || !(this.client as any).files || typeof (this.client as any).files.del !== 'function') {
                console.error('OpenAIService.deleteUploadedFile: Client or files.del function is not available.');
                return false;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (this.client as any).files.del(fileId);
            return true;
        } catch (_error: unknown) {
            const error = _error as Error;
            console.error(`OpenAIService: Error deleting OpenAI file ${fileId}:`, error.message || error);
            return false;
        } finally {
            console.timeEnd(`OpenAIService_deleteUploadedFile_${fileId}`);
        }
    }

    /**
     * Updates the assistant with proper instructions to ensure response generation after file search.
     * This fixes the common issue where assistants complete file search but don't generate responses.
     */
    public async updateAssistantInstructions(): Promise<boolean> {
        if (!this.isAssistantConfigured() || !this.apiKey) {
            console.log('[OpenAIService] Cannot update assistant - not configured properly');
            return false;
        }

        try {
            const response = await fetch(`https://api.openai.com/v1/assistants/${this.presetAssistantId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    instructions: `You are a helpful AI assistant for analyzing and discussing note content. When a user asks a question, you must:

1. ALWAYS use the file_search tool to find relevant information from uploaded documents
2. After completing the file search, you MUST analyze the search results
3. You MUST then generate a comprehensive, helpful response based on what you found
4. If the search doesn't find perfect matches, still provide the best possible answer based on available information
5. NEVER end the conversation after just completing a tool - always provide a response to the user
6. Always provide a detailed analysis and summary when users ask about note content

You have access to documents through file search. Use this tool to find relevant information, then provide thoughtful responses based on that content.`
                })
            });

            if (!response.ok) {
                console.error('[OpenAIService] Failed to update assistant instructions:', response.status);
                return false;
            }

            const updatedAssistant = await response.json();
            console.log('[OpenAIService] Successfully updated assistant instructions:', updatedAssistant.id);
            return true;
        } catch (error) {
            console.error('[OpenAIService] Error updating assistant instructions:', error);
            return false;
        }
    }

    /**
     * Updates the assistant's model to match the current settings.
     * This ensures the assistant uses the model selected by the user.
     */
    public async updateAssistantModel(newModel: string): Promise<boolean> {
        if (!this.isAssistantConfigured() || !this.apiKey) {
            console.log('[OpenAIService] Cannot update assistant model - not configured properly');
            return false;
        }

        try {
            console.log(`[OpenAIService] Updating assistant model from current to: ${newModel}`);
            
            const response = await fetch(`https://api.openai.com/v1/assistants/${this.presetAssistantId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    model: newModel
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[OpenAIService] Failed to update assistant model:', response.status, errorData);
                return false;
            }

            const updatedAssistant = await response.json();
            console.log('[OpenAIService] Successfully updated assistant model to:', updatedAssistant.model);
            return true;
        } catch (error) {
            console.error('[OpenAIService] Error updating assistant model:', error);
            return false;
        }
    }

    /**
     * Retrieves and logs the current assistant configuration for debugging
     */
    public async getAssistantConfiguration(): Promise<Record<string, unknown> | null> {
        if (!this.isAssistantConfigured() || !this.apiKey) {
            console.log('[OpenAIService] Cannot retrieve assistant - not configured properly');
            return null;
        }

        try {
            const response = await fetch(`https://api.openai.com/v1/assistants/${this.presetAssistantId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            if (!response.ok) {
                console.error('[OpenAIService] Failed to retrieve assistant configuration:', response.status);
                return null;
            }

            const assistant = await response.json();
            console.log('[OpenAIService] Current assistant configuration:', JSON.stringify(assistant, null, 2));
            return assistant;
        } catch (error) {
            console.error('[OpenAIService] Error retrieving assistant configuration:', error);
            return null;
        }
    }

    /**
     * Generate a simple hash of file content for caching purposes
     */
    private async hashContent(content: string): Promise<string> {
        // Simple hash function - in production you might want to use crypto.subtle.digest
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Clear the file cache (useful for testing or memory management)
     */
    public clearFileCache(): void {
        console.log(`OpenAIService: Clearing file cache (${this.fileCache.size} entries)`);
        this.fileCache.clear();
    }

    /**
     * Get cache statistics for debugging
     */
    public getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.fileCache.size,
            entries: Array.from(this.fileCache.keys())
        };
    }

    /**
     * Converts text to speech using the OpenAI TTS API.
     * @param text The text to convert to speech.
     * @param options Optional TTS configuration options.
     * @returns A promise that resolves with the audio blob or null if an error occurs.
     */
    async textToSpeech(
        text: string,
        options?: {
            voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
            instructions?: string;
            format?: 'mp3' | 'wav' | 'opus';
            speed?: number;
        }
    ): Promise<Blob | null> {
        console.time("OpenAIService_textToSpeech");
        try {
            if (!this.apiKey) {
                console.error('OpenAI API key is not configured. Cannot generate speech.');
                return null;
            }
            
            if (!text || text.trim().length === 0) {
                console.error('Text input is empty or invalid.');
                return null;
            }

            // Default options
            const ttsOptions = {
                voice: options?.voice || 'alloy',
                format: options?.format || 'mp3',
                speed: options?.speed || 1.0,
                ...options
            };

            console.log(`Generating speech via manual fetch: Text length=${text.length}, Voice=${ttsOptions.voice}, Format=${ttsOptions.format}`);

            const requestBody: Record<string, unknown> = {
                model: 'gpt-4o-mini-tts',
                input: text,
                voice: ttsOptions.voice,
                response_format: ttsOptions.format,
                speed: ttsOptions.speed
            };

            // Add instructions if provided
            if (ttsOptions.instructions) {
                requestBody.instructions = ttsOptions.instructions;
            }

            const apiUrl = 'https://api.openai.com/v1/audio/speech';

            console.log('Sending manual fetch request to OpenAI TTS API...');
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('Received response from TTS API:', response.status, response.statusText);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = { message: await response.text() };
                }
                
                let errorMessage = `OpenAI TTS API Error (${response.status}): ${errorData?.error?.message || response.statusText || 'Unknown error'}`;
                if (response.status === 401) {
                    errorMessage = 'OpenAI Authentication Error. Please check your API key.';
                } else if (response.status === 429) {
                    errorMessage = 'OpenAI Rate Limit Exceeded. Please try again later.';
                } else if (response.status === 400) {
                    errorMessage = `OpenAI TTS API Bad Request (${response.status}): ${errorData?.error?.message || 'Check request parameters.'}`;
                }
                console.error(errorMessage);
                return null;
            }

            // Convert response to blob
            const audioBlob = await response.blob();
            console.log('TTS audio blob received:', audioBlob.size, 'bytes, type:', audioBlob.type);

            if (audioBlob.size === 0) {
                console.error('Received empty audio blob from TTS API');
                return null;
            }

            return audioBlob;

        } catch (error) {
            console.error('Error during text-to-speech conversion:', error);
            return null;
        } finally {
            console.timeEnd("OpenAIService_textToSpeech");
        }
    }
}
