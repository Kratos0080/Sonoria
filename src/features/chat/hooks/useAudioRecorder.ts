import { useState, useRef, useCallback } from 'react';
import { Notice } from 'obsidian';
import { VoiceInteractionState } from '../context/VoiceContext'; // Import enum

// TODO: Define specific types for recorder state, permissions, etc.
// Internal state, distinct from VoiceContext state but often related
type RecorderHookState = 'idle' | 'requesting_permission' | 'permission_denied' | 'ready' | 'recording' | 'error';
type PermissionStatus = 'prompt' | 'granted' | 'denied';

interface UseAudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onRecordingStart?: () => void;
  onError?: (error: Error) => void;
  setVoiceState: (state: VoiceInteractionState) => void; // Add context setter
  onLLMResponse?: (userTranscript: string, aiResponse: string, threadId: string | null) => void; // Handler for LLM response
  // Consider adding mimeType preference if needed
}

interface UseAudioRecorderReturn {
  recorderState: RecorderHookState; // Use internal state type
  permissionStatus: PermissionStatus;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  requestPermission: () => Promise<void>; // Explicit permission request
  cleanup: () => void; // Add cleanup function
}

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MIN_RECORDING_DURATION_MS = 500; // Example: require at least 0.5 seconds

export const useAudioRecorder = ({
  onRecordingComplete,
  onRecordingStart,
  onError,
  setVoiceState, // Destructure context setter
  onLLMResponse, // Destructure onLLMResponse
}: UseAudioRecorderProps): UseAudioRecorderReturn => {
  const [recorderState, setRecorderState] = useState<RecorderHookState>('idle');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Helper to handle errors consistently
  const handleError = useCallback((message: string, error?: unknown) => {
      console.error(message, error ?? '');
      setRecorderState('error');
      setVoiceState(VoiceInteractionState.VOICE_ERROR);
      const userMessage = `${message}${error instanceof Error ? ` (${error.message})` : ''}`;
      new Notice(userMessage, 5000); // Show notice for 5 seconds
      onError?.(error instanceof Error ? error : new Error(String(error ?? 'Unknown audio error')));
       // Clean up stream tracks on error
       mediaRecorderRef.current?.stream?.getTracks().forEach(track => track.stop());
       recordingStartTimeRef.current = null;
       // Ensure recorder is stopped if it was somehow active
       if (mediaRecorderRef.current?.state === 'recording') {
           try { mediaRecorderRef.current.stop(); } catch (e) { console.error("Error stopping recorder during cleanup:", e); }
       }
  }, [onError, setVoiceState]);

  // --- Permission Handling (Sub-Task 4.3.2) ---
  const checkAndRequestPermissions = useCallback(async (): Promise<boolean> => {
    console.log('Checking/Requesting microphone permissions...');
    setRecorderState('requesting_permission');
    // Don't set voice state here, wait for outcome
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted.');
      setPermissionStatus('granted');
      setRecorderState('ready');
      // setVoiceState(VoiceInteractionState.VOICE_IDLE); // Or ready? Let consuming component decide based on mode.
      return true;
    } catch (err) {
      setPermissionStatus('denied');
      // Use handleError for consistent reporting
      handleError('Microphone permission denied or unavailable.', err);
      return false;
    }
  }, [handleError]); // Include handleError

  const requestPermission = useCallback(async () => {
    await checkAndRequestPermissions();
  }, [checkAndRequestPermissions]);

  // --- Recording Logic (Sub-Tasks 4.3.3, 4.3.4, 4.3.6) ---
  const startRecording = useCallback(async () => {
    console.log(`useAudioRecorder: About to start recording, current state: ${recorderState}`);
    
    if (recorderState === 'recording') {
      console.warn('Already recording.');
      return;
    }

    // Force cleanup of any existing recorder before starting new recording
    if (mediaRecorderRef.current) {
      console.log('useAudioRecorder: Cleaning up existing recorder before starting new recording');
      try {
        // Stop any existing streams
        mediaRecorderRef.current.stream?.getTracks().forEach(track => {
          console.log(`useAudioRecorder: Stopping track: ${track.kind}, state: ${track.readyState}`);
          track.stop();
        });
      } catch (err) {
        console.warn('useAudioRecorder: Error stopping existing tracks:', err);
      }
      mediaRecorderRef.current = null;
    }

    const hasPermission = permissionStatus === 'granted' || await checkAndRequestPermissions();
    if (!hasPermission) {
      // Error handled in checkAndRequestPermissions
      return;
    }

    // 🎯 AUTOPLAY FIX: Establish user gesture for autoplay when recording starts
    const conversationManager = window.sonoriaPlugin?.conversationManager;
    if (conversationManager) {
      conversationManager.establishUserGestureForAutoplay();
      console.log('🎯 useAudioRecorder: User gesture established for autoplay via voice recording');
    }

    setRecorderState('recording');
    setVoiceState(VoiceInteractionState.VOICE_RECORDING); // Update context state
    audioChunksRef.current = [];
    recordingStartTimeRef.current = Date.now();
    onRecordingStart?.();

    try {
      // 🎯 VOICE QUALITY IMPROVEMENT: Enable browser-native audio processing features
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,     // Remove echo from speakers
          noiseSuppression: true,     // Reduce background noise
          autoGainControl: true,      // Auto-adjust volume levels
          sampleRate: 16000,          // Optimal for Whisper API
          channelCount: 1             // Mono audio sufficient for speech
        }
      });
      const options = { mimeType: 'audio/webm;codecs=opus' };
      let chosenMimeType = options.mimeType;
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
         console.warn(`${options.mimeType} not supported, trying default.`);
         // TODO: Implement fallback logic if needed (e.g., try audio/mp4)
         mediaRecorderRef.current = new MediaRecorder(stream);
         chosenMimeType = 'audio/webm'; // Assume default if specific fails
      } else {
         mediaRecorderRef.current = new MediaRecorder(stream, options);
      }

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log(`useAudioRecorder: ondataavailable - event.data.size: ${event.data.size}`);
        
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('useAudioRecorder: onstop event fired');
        const recordingStopTime = Date.now();
        const duration = recordingStopTime - (recordingStartTimeRef.current ?? recordingStopTime);

        // Use the chosen mimeType when creating the blob
        const audioBlob = new Blob(audioChunksRef.current, { type: chosenMimeType });
        audioChunksRef.current = [];

        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size === 0 || duration < MIN_RECORDING_DURATION_MS) {
          handleError('Recording was too short or empty.');
        } else if (audioBlob.size > MAX_FILE_SIZE_BYTES) {
          handleError(`Recording too large (>${MAX_FILE_SIZE_MB}MB). Please keep it shorter.`);
        } else {
          console.log(`Recording complete: Size=${(audioBlob.size / 1024).toFixed(1)} KB, Duration=${(duration/1000).toFixed(1)}s`);
          onRecordingComplete?.(audioBlob);
          setRecorderState('ready');
          // Set voice state back to idle *after* processing is complete (in Task 4.4/4.5/4.6)
          // For now, we can set it back to idle here for testing purposes
          setVoiceState(VoiceInteractionState.VOICE_IDLE);
        }
         recordingStartTimeRef.current = null;
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('useAudioRecorder: onerror event fired:', event);
        handleError('An error occurred during recording.', event);
      };

      console.log('useAudioRecorder: About to call mediaRecorder.start()');
      mediaRecorderRef.current.start();
      console.log('useAudioRecorder: mediaRecorder.start() called successfully');
      
      // Add a small delay to check if recording actually started
      setTimeout(() => {
        console.log(`useAudioRecorder: MediaRecorder state after 150ms: ${mediaRecorderRef.current?.state}`);
      }, 150);

    } catch (err) {
        handleError('Failed to start recording.', err);
    }
  }, [recorderState, permissionStatus, checkAndRequestPermissions, onRecordingStart, onRecordingComplete, handleError, setVoiceState]); // Add dependencies

  const stopRecording = useCallback(() => {
    if (recorderState !== 'recording' || !mediaRecorderRef.current) {
      console.warn('Not recording or recorder not initialized.');
      if(recorderState !== 'idle' && recorderState !== 'error') {
         setRecorderState('ready');
         setVoiceState(VoiceInteractionState.VOICE_IDLE);
      }
      return;
    }

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => { // Make onstop async
        const recordingStopTime = Date.now();
        const duration = recordingStopTime - (recordingStartTimeRef.current ?? recordingStopTime);
        const chosenMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'; // Get actual mimeType used

        const audioBlob = new Blob(audioChunksRef.current, { type: chosenMimeType });
        audioChunksRef.current = [];

        // Ensure stream tracks are stopped *before* async operations
        mediaRecorderRef.current?.stream?.getTracks().forEach(track => track.stop());
        recordingStartTimeRef.current = null;
        setRecorderState('ready'); // Recorder is ready for next use

        // --- Validation ---
        if (audioBlob.size === 0 || duration < MIN_RECORDING_DURATION_MS) {
          handleError('Recording was too short or empty.');
        } else if (audioBlob.size > MAX_FILE_SIZE_BYTES) {
          handleError(`Recording too large (>${MAX_FILE_SIZE_MB}MB). Please keep it shorter.`);
        } else {
           // --- STT Processing (Task 4.4 Integration) ---
           console.log(`Recording complete: Size=${(audioBlob.size / 1024).toFixed(1)} KB, Duration=${(duration/1000).toFixed(1)}s`);
           // Removed onRecordingComplete?.(audioBlob); -> Let this hook handle STT
           
           // Fetch the LATEST OpenAIService instance directly from the plugin
           const currentPlugin = window.sonoriaPlugin;
           const currentOpenAIService = currentPlugin?.openAIService;
           const conversationManager = currentPlugin?.conversationManager;

           if (!currentOpenAIService || !currentOpenAIService.isAvailable()) {
               handleError('OpenAI Service is not available. Please check API key in settings.');
               return; // Exit early
           }

           setVoiceState(VoiceInteractionState.VOICE_PROCESSING_STT);
           console.log("Attempting to transcribe audio via OpenAIService...");

           try {
               // Use the freshly fetched service instance
               const transcriptionText = await currentOpenAIService.transcribeAudio(audioBlob);

               if (transcriptionText !== null) {
                   console.log('Transcription successful:', transcriptionText);
                   setVoiceState(VoiceInteractionState.VOICE_PROCESSING_LLM);
                   
                   // Use callback system for voice mode TTS handling
                   if (onLLMResponse && conversationManager) {
                       console.log('Voice mode: Processing message with TTS callback');
                       
                       try {
                           // Use sendMessage to process the message normally (adds to conversation)
                           await conversationManager.sendMessage(transcriptionText);
                           
                           // Get the AI response that was just added to the conversation
                           const messages = conversationManager.getMessages();
                           const lastMessage = messages[messages.length - 1];
                           let aiResponseText = '';
                           
                           if (lastMessage && lastMessage.role === 'assistant') {
                               aiResponseText = lastMessage.content;
                               console.log('Voice mode: Captured AI response for TTS');
                           } else {
                               console.warn('Voice mode: Could not find AI response in conversation');
                           }
                           
                           // Call the callback to trigger TTS in voice conversation mode
                           onLLMResponse(transcriptionText, aiResponseText, null);
                           
                           setVoiceState(VoiceInteractionState.VOICE_IDLE);
                       } catch (error) {
                           console.error('Voice mode: Failed to process message:', error);
                           handleError('Failed to get AI response.', error);
                       }
                   } else if (conversationManager) {
                       // Fallback to direct sendMessage for components that don't use onLLMResponse (like dictation)
                       console.log('Text mode: Using direct sendMessage (no TTS)');
                       await conversationManager.sendMessage(transcriptionText);
                       setVoiceState(VoiceInteractionState.VOICE_IDLE);
                   } else {
                       handleError('ConversationManager not available for voice message processing.');
                   }
               } else {
                   console.error('Transcription failed (handled internally by OpenAIService).');
                   setVoiceState(VoiceInteractionState.VOICE_ERROR);
                   if ((recorderState as RecorderHookState) !== 'error') { 
                       setRecorderState('error');
                   } 
                   // Optionally call external onError here too if needed
                   onError?.(new Error('Transcription failed.'));
               }
           } catch (error) {
               // Catch any unexpected errors during the async call itself
               handleError('An unexpected error occurred during transcription.', error);
           }
        }
      };

       try {
        mediaRecorderRef.current.stop(); // Trigger the async onstop handler
       } catch (error) {
           handleError('Failed to stop recording gracefully.', error);
       }
    }
  }, [recorderState, handleError, setVoiceState, onError, onLLMResponse]); // Removed plugin?.settings and openAIService from deps

  const cleanup = useCallback(() => {
    console.log('useAudioRecorder: Cleanup called - resetting all recorder state');
    
    try {
      // Stop any active recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('useAudioRecorder: Stopping active recording during cleanup');
        mediaRecorderRef.current.stop();
      }
      
      // Stop all media tracks
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          console.log(`useAudioRecorder: Cleanup - stopping track: ${track.kind}`);
          track.stop();
        });
      }
      
      // Clear all refs and state
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = null;
      
      // Reset states to idle
      setRecorderState('idle');
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
      
      console.log('useAudioRecorder: Cleanup completed successfully');
    } catch (error) {
      console.warn('useAudioRecorder: Error during cleanup:', error);
      // Still reset states even if cleanup had errors
      setRecorderState('idle');
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
    }
  }, [setVoiceState]);

  return {
    recorderState,
    permissionStatus,
    startRecording,
    stopRecording,
    requestPermission,
    cleanup,
  };
}; 