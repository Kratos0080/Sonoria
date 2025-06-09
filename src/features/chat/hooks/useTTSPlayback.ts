import { useState, useCallback, useRef, useEffect } from 'react';
import { Notice } from 'obsidian';
import { removeCitationAnnotations } from '../../../utils/textUtils';
import { useVoiceModeCheck, useVoiceMode } from '../context/VoiceModeContext';

// Type for ConversationManager with Progressive TTS properties
type ConversationManagerWithProgressiveTTS = {
  progressiveAudioPlayback?: {
    hasAudioForMessage?: (messageId: string) => boolean;
    isPlayingMessage?: (messageId: string) => boolean;
    playMessage?: (messageId: string) => Promise<void>;
    stopMessage?: (messageId: string) => void;
    startPlaybackForMessage?: (messageId: string) => Promise<void>;
    stopPlaybackForMessage?: (messageId: string) => void;
    onPlaybackComplete?: (messageId: string) => void;
  };
  generateProgressiveTTSOnDemand?: (messageContent: string, messageId: string) => Promise<boolean>;
};

export interface TTSPlaybackState {
  isGenerating: boolean;
  isPlaying: boolean;
  hasAudio: boolean;
  error: string | null;
}

export interface TTSPlaybackControls {
  playAudio: (blobToPlay?: Blob) => Promise<void>;
  stopAudio: () => void;
  generateAndPlay: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing TTS playback state per message
 * In voice mode, prefers to use shared audio from VoiceModeContext
 * Falls back to on-demand generation in text/dictation mode
 */
export const useTTSPlayback = (
  messageContent: string,
  messageId: string,
  existingAudioBlob?: Blob | null
): TTSPlaybackState & TTSPlaybackControls => {
  // Voice mode context for shared audio - always call hooks at top level
  const { isVoiceConversationMode } = useVoiceModeCheck();
  const voiceModeContext = useVoiceMode();
  
  // Extract values from context (but only use them if in voice mode)
  const getAudio = isVoiceConversationMode ? voiceModeContext.getAudio : null;
  const currentPlayingMessageId = isVoiceConversationMode ? voiceModeContext.currentPlayingMessageId : null;
  const setCurrentPlayingMessageId = isVoiceConversationMode ? voiceModeContext.setCurrentPlayingMessageId : null;
  
  // Local state
  const [isGenerating, setIsGenerating] = useState(false);
  const [localAudioBlob, setLocalAudioBlob] = useState<Blob | null>(existingAudioBlob || null);
  const [error, setError] = useState<string | null>(null);
  
  // State polling for Progressive TTS reactivity
  const [progressiveTTSPlaying, setProgressiveTTSPlaying] = useState(false);
  
  // 🎯 ON-DEMAND TTS STATE: Track generation progress
  const [isGeneratingProgressiveTTS, setIsGeneratingProgressiveTTS] = useState(false);
  const [progressiveTTSRequested, setProgressiveTTSRequested] = useState(false);
  
  // Audio element ref for local playback control
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const eventListenersRef = useRef<{[key: string]: (event?: Event) => void}>({});
  
  // Timeout ref for Progressive TTS generation
  const progressiveTTSTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Poll Progressive TTS state for reactivity (only when needed)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let eventCleanup: (() => void) | null = null;
    
    const conversationManager = window.sonoriaPlugin?.conversationManager as ConversationManagerWithProgressiveTTS | undefined;
    if (conversationManager && conversationManager.progressiveAudioPlayback) {
      const progressiveAudio = conversationManager.progressiveAudioPlayback;
      
      // 🔧 IMMEDIATE EVENT LISTENER: Listen for immediate state change events
      const handleStateChangeEvent = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { messageId: eventMessageId, eventType, isPlaying: eventIsPlaying } = customEvent.detail;
        
        // Only handle events for this specific message
        if (eventMessageId === messageId) {
          console.log(`🔄 TTS Hook: Received immediate state change event for message ${messageId.substring(0, 8)}: ${eventType}, isPlaying: ${eventIsPlaying}`);
          
          // Update state immediately based on the event
          if (eventIsPlaying !== progressiveTTSPlaying) {
            setProgressiveTTSPlaying(eventIsPlaying);
            console.log(`🔄 TTS Hook: Immediate state update - playing: ${eventIsPlaying} for message ${messageId.substring(0, 8)}`);
          }
          
          // Reset requested state when playback starts or stops
          if ((eventType === 'playing' || eventType === 'auto-started') && !progressiveTTSRequested) {
            // Playback started - we can mark as requested for proper state tracking
            setProgressiveTTSRequested(true);
          } else if (eventType === 'stopped' && progressiveTTSRequested) {
            // Playback stopped - clear requested state for proper button sync
            setProgressiveTTSRequested(false);
          }
        }
      };
      
      // Add event listener for immediate state changes
      window.addEventListener('progressiveTTSStateChange', handleStateChangeEvent);
      eventCleanup = () => {
        window.removeEventListener('progressiveTTSStateChange', handleStateChangeEvent);
      };
      
      // 🔧 IMPROVED POLLING CONDITION: Only poll when message has audio or is actively being generated
      const hasAudio = progressiveAudio.hasAudioForMessage && progressiveAudio.hasAudioForMessage(messageId);
      const shouldPoll = hasAudio || progressiveTTSRequested || progressiveTTSPlaying;
      
      if (shouldPoll) {
        interval = setInterval(() => {
          const isCurrentlyPlaying = progressiveAudio.isPlayingMessage && progressiveAudio.isPlayingMessage(messageId);
          
          // 🔧 VOICE MODE FIX: Enhanced state change detection for pause/resume scenarios
          if (isCurrentlyPlaying !== progressiveTTSPlaying) {
            console.log(`🔄 Progressive TTS State Change (polling): message ${messageId.substring(0, 8)} playing: ${isCurrentlyPlaying} (voice mode: ${isVoiceConversationMode})`);
            setProgressiveTTSPlaying(isCurrentlyPlaying || false);
            
            // 🔧 BUTTON SYNC FIX: Force UI update by clearing and resetting requested state when playback state changes
            if (!isCurrentlyPlaying && progressiveTTSRequested) {
              console.log(`🔄 Progressive TTS: Playback stopped (polling), clearing requested state for proper button sync`);
              setProgressiveTTSRequested(false);
            }
          }
        }, 50); // 🔧 RESPONSIVENESS FIX: Increased polling frequency to 50ms for faster button state updates during auto-play
      } else {
        // Reset state if no Progressive TTS audio and not requested
        if (progressiveTTSPlaying) {
          setProgressiveTTSPlaying(false);
        }
        if (progressiveTTSRequested) {
          setProgressiveTTSRequested(false);
        }
      }
    } else {
      // Reset state if no Progressive TTS available
      if (progressiveTTSPlaying) {
        setProgressiveTTSPlaying(false);
      }
      if (progressiveTTSRequested) {
        setProgressiveTTSRequested(false);
      }
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (eventCleanup) {
        eventCleanup();
      }
    };
  }, [messageId, progressiveTTSRequested, progressiveTTSPlaying, isVoiceConversationMode]);
  
  // Determine if we're playing (Progressive TTS > shared audio > local audio)
  const isPlaying = (() => {
    // 🚀 PROGRESSIVE TTS PRIORITY: Use polled state for reactivity
    if (progressiveTTSPlaying) {
      console.log(`🎯 Playing State: message ${messageId.substring(0, 8)} playing via Progressive TTS`);
      return true;
    }
    
    // Voice mode: Check shared audio (backup)
    if (isVoiceConversationMode && currentPlayingMessageId === messageId) {
      // Reduce log frequency for shared audio (log only occasionally)
      if (Math.random() < 0.1) {
        console.log(`🎯 Playing State: message ${messageId.substring(0, 8)} playing via shared audio`);
      }
      return true;
    }
    
    // Local audio (final fallback)
    const localPlaying = Boolean(localAudioRef.current && !localAudioRef.current.paused && !localAudioRef.current.ended);
    if (localPlaying) {
      console.log(`🎯 Playing State: message ${messageId.substring(0, 8)} playing via local audio`);
    }
    return localPlaying;
  })();
  
  // Determine if audio is available (Progressive TTS > shared > local)
  const hasAudio = (() => {
    // 🚀 PROGRESSIVE TTS PRIORITY: Check Progressive TTS audio first
    const conversationManager = window.sonoriaPlugin?.conversationManager as ConversationManagerWithProgressiveTTS | undefined;
    if (conversationManager && conversationManager.progressiveAudioPlayback) {
      const progressiveAudio = conversationManager.progressiveAudioPlayback;
      if (progressiveAudio.hasAudioForMessage && progressiveAudio.hasAudioForMessage(messageId)) {
        return true;
      }
    }
    
    // Voice mode: Check shared audio (backup)
    if (isVoiceConversationMode && getAudio) {
      if (getAudio(messageId)) {
        return true;
      }
    }
    
    // Local audio (final fallback)
    return Boolean(localAudioBlob);
  })();
  
  // Cleanup function for local audio only
  const cleanup = useCallback(() => {
    try {
      // Clear Progressive TTS timeout if active
      if (progressiveTTSTimeoutRef.current) {
        clearTimeout(progressiveTTSTimeoutRef.current);
        progressiveTTSTimeoutRef.current = null;
      }
      
      if (localAudioRef.current) {
        const audio = localAudioRef.current;
        
        // Pause audio safely if it's playing and not in an error state
        if (audio.readyState >= 1 && !audio.paused && !audio.ended) {
          try {
            audio.pause();
          } catch (pauseErr) {
            console.warn(`Audio pause warning during cleanup for message ${messageId}:`, pauseErr);
          }
        }
        
        // Remove all event listeners
        Object.values(eventListenersRef.current).forEach((listener) => {
          if (listener && typeof listener === 'function') {
            try {
              audio.removeEventListener('play', listener);
              audio.removeEventListener('pause', listener);
              audio.removeEventListener('ended', listener);
              audio.removeEventListener('error', listener);
            } catch (err) {
              console.warn(`Event listener removal warning for message ${messageId}:`, err);
            }
          }
        });
        
        eventListenersRef.current = {};
        localAudioRef.current = null;
      }
    } catch (err) {
      console.warn(`Cleanup warning for message ${messageId}:`, err);
    }
    
    // Revoke object URL to free memory
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      } catch (err) {
        console.warn(`Object URL revocation warning for message ${messageId}:`, err);
      }
    }
  }, [messageId]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Reset Progressive TTS state on unmount
      setProgressiveTTSRequested(false);
      setProgressiveTTSPlaying(false);
      cleanup();
    };
  }, [cleanup]);
  
  // Generate TTS audio from text (for local/text mode)
  const generateTTS = useCallback(async (): Promise<Blob | null> => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Get OpenAI service instance
      const openAIService = window.sonoriaPlugin?.openAIService;
      if (!openAIService) {
        throw new Error('OpenAI service not available');
      }
      
      if (!messageContent || messageContent.trim().length === 0) {
        throw new Error('No content to convert to speech');
      }
      
      console.log(`Generating TTS for message ${messageId}:`, messageContent.substring(0, 100) + '...');
      
      // 🔧 CITATION CLEANUP: Remove citation annotations as safety measure for saved messages
      const cleanMessageContent = removeCitationAnnotations(messageContent);
      
      const blob = await openAIService.textToSpeech(cleanMessageContent, {
        voice: 'alloy', // Could be configurable in the future
        format: 'mp3'
      });
      
      if (!blob) {
        throw new Error('TTS generation failed');
      }
      
      console.log(`TTS generated successfully for message ${messageId}: ${blob.size} bytes`);
      setLocalAudioBlob(blob);
      return blob;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown TTS error';
      console.error(`TTS generation error for message ${messageId}:`, err);
      setError(errorMessage);
      new Notice(`TTS Error: ${errorMessage}`, 3000);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [messageContent, messageId]);
  
  // 🎯 ON-DEMAND PROGRESSIVE TTS: Generate Progressive TTS for text/dictation mode
  const generateProgressiveTTSOnDemand = useCallback(async (): Promise<boolean> => {
    if (progressiveTTSRequested) {
      console.log(`Progressive TTS already requested for message ${messageId}, skipping duplicate request`);
      return true; // Assume it's in progress
    }
    
    const conversationManager = window.sonoriaPlugin?.conversationManager as ConversationManagerWithProgressiveTTS | undefined;
    if (!conversationManager || typeof conversationManager.generateProgressiveTTSOnDemand !== 'function') {
      console.warn('ConversationManager or generateProgressiveTTSOnDemand method not available');
      return false;
    }
    
    console.log(`🎯 On-Demand TTS: Starting generation for message ${messageId}`);
    setIsGeneratingProgressiveTTS(true);
    setProgressiveTTSRequested(true);
    setError(null);
    
    try {
      // Set up 5-second timeout as per user specification
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        progressiveTTSTimeoutRef.current = setTimeout(() => {
          reject(new Error('Progressive TTS generation timeout (5 seconds)'));
        }, 5000);
      });
      
      // Race between generation and timeout
      const generationPromise = conversationManager.generateProgressiveTTSOnDemand(messageContent, messageId);
      
      const success = await Promise.race([generationPromise, timeoutPromise]);
      
      // Clear timeout if generation completed first
      if (progressiveTTSTimeoutRef.current) {
        clearTimeout(progressiveTTSTimeoutRef.current);
        progressiveTTSTimeoutRef.current = null;
      }
      
      if (success) {
        console.log(`🎯 On-Demand TTS: Generation successful for message ${messageId}`);
        return true;
      } else {
        console.warn(`🎯 On-Demand TTS: Generation failed for message ${messageId}`);
        return false;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`🎯 On-Demand TTS: Generation error for message ${messageId}:`, errorMessage);
      
      // Clear timeout on error
      if (progressiveTTSTimeoutRef.current) {
        clearTimeout(progressiveTTSTimeoutRef.current);
        progressiveTTSTimeoutRef.current = null;
      }
      
      // If timeout, we'll fall back to traditional TTS
      if (errorMessage.includes('timeout')) {
        console.log(`🎯 On-Demand TTS: Timeout reached, will fall back to traditional TTS`);
      }
      
      return false;
    } finally {
      setIsGeneratingProgressiveTTS(false);
    }
  }, [messageContent, messageId, progressiveTTSRequested]);
  
  // Play audio from blob (local mode)
  const playLocalAudio = useCallback(async (blobToPlay?: Blob): Promise<void> => {
    // Use the provided blob or fall back to the state blob
    const targetBlob = blobToPlay || localAudioBlob;
    
    if (!targetBlob) {
      console.warn('No audio blob available for local playback');
      return;
    }
    
    try {
      setError(null);
      
      // Cleanup any existing audio
      cleanup();
      
      // Create new audio element and object URL
      objectUrlRef.current = URL.createObjectURL(targetBlob);
      localAudioRef.current = new Audio(objectUrlRef.current);
      
      const audio = localAudioRef.current;
      
      // Create and store event listeners
      const handlePlay = () => {
        console.log(`Local audio playback started for message ${messageId}`);
      };
      
      const handlePause = () => {
        console.log(`Local audio playback paused for message ${messageId}`);
      };
      
      const handleEnded = () => {
        console.log(`Local audio playback completed for message ${messageId}`);
        cleanup();
      };
      
      const handleError = (event?: Event) => {
        const audioError = event ? (event.target as HTMLAudioElement)?.error : null;
        const errorMessage = `Local audio playback error: ${audioError?.message || 'Unknown error'}`;
        console.error(`Local audio playback error for message ${messageId}:`, audioError);
        setError(errorMessage);
        cleanup();
      };
      
      // Store references for later removal
      eventListenersRef.current = {
        play: handlePlay,
        pause: handlePause,
        ended: handleEnded,
        error: handleError
      };
      
      // Set up event listeners
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Start playback
      await audio.play();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown playback error';
      console.error(`Local audio playback error for message ${messageId}:`, err);
      setError(errorMessage);
      cleanup();
    }
  }, [localAudioBlob, messageId, cleanup]);
  
  // 🔧 PROGRESSIVE TTS COMPLETION HANDLER: Listen for playback completion events
  useEffect(() => {
    const conversationManager = window.sonoriaPlugin?.conversationManager as ConversationManagerWithProgressiveTTS | undefined;
    if (conversationManager && conversationManager.progressiveAudioPlayback) {
      const progressiveAudio = conversationManager.progressiveAudioPlayback;
      
      // 🔧 COMPLETION EVENT FIX: Set up completion handler directly on the ProgressiveAudioPlayback instance
      const onComplete = (completedMessageId: string) => {
        if (completedMessageId === messageId) {
          console.log(`🔄 Progressive TTS: Playback completed - for completion events (message ${messageId.substring(0, 8)})`);
          setProgressiveTTSPlaying(false);
          setProgressiveTTSRequested(false); // Also reset requested state
          
          // Update voice mode context if in voice mode
          if (isVoiceConversationMode && setCurrentPlayingMessageId && currentPlayingMessageId === messageId) {
            setCurrentPlayingMessageId(null);
          }
        }
      };
      
      // Set up completion handler directly on the instance
      progressiveAudio.onPlaybackComplete = onComplete;
      
      return () => {
        // Clean up completion handler
        if (progressiveAudio && progressiveAudio.onPlaybackComplete === onComplete) {
          progressiveAudio.onPlaybackComplete = undefined;
        }
      };
    }
    
    // Always return a cleanup function (even if empty) to satisfy TypeScript
    return () => {
      // No cleanup needed if no progressiveAudio available
    };
  }, [messageId, isVoiceConversationMode, setCurrentPlayingMessageId, currentPlayingMessageId]);
  
  // Unified play audio function - prioritizes Progressive TTS, then shared audio, then local generation
  const playAudio = useCallback(async (blobToPlay?: Blob): Promise<void> => {
    // 🚀 PROGRESSIVE TTS PRIORITY: Check for Progressive TTS audio first
    const conversationManager = window.sonoriaPlugin?.conversationManager as ConversationManagerWithProgressiveTTS | undefined;
    if (conversationManager && conversationManager.progressiveAudioPlayback) {
      const progressiveAudio = conversationManager.progressiveAudioPlayback;
      
      const hasProgressiveAudio = progressiveAudio.hasAudioForMessage && progressiveAudio.hasAudioForMessage(messageId);
      console.log(`🎯 TTS Debug: messageId=${messageId.substring(0, 8)}, hasProgressiveAudio=${hasProgressiveAudio}, isVoiceMode=${isVoiceConversationMode}`);
      
      // Check if Progressive TTS has audio for this message
      if (hasProgressiveAudio) {
        console.log(`🎯 Progressive TTS: Using existing progressive audio for message ${messageId}`);
        try {
          setError(null);
          // Start Progressive TTS playback for this message
          if (progressiveAudio.startPlaybackForMessage) {
            await progressiveAudio.startPlaybackForMessage(messageId);
          }
          
          // Update voice mode context if in voice mode
          if (isVoiceConversationMode && setCurrentPlayingMessageId) {
            setCurrentPlayingMessageId(messageId);
          }
          
          // Reset requested state since playback started successfully
          console.log(`🎯 Progressive TTS: Playback started successfully, resetting requested state for message ${messageId}`);
          return;
        } catch (err) {
          console.warn(`Progressive TTS playback failed for message ${messageId}, falling back:`, err);
          // Fall through to backup methods
        }
      } else if (isVoiceConversationMode) {
        // 🎯 VOICE MODE FIX: If no Progressive TTS audio in voice mode, try to generate on-demand
        console.log(`🎯 Voice Mode TTS: No progressive audio found for message ${messageId}, attempting on-demand generation`);
        
        try {
          const generationSuccess = await generateProgressiveTTSOnDemand();
          
          if (generationSuccess) {
            // Wait for first sentence audio to actually be available
            let retries = 0;
            const maxRetries = 20; // Wait up to 10 seconds (20 * 500ms)
            
            while (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500));
              
              if (progressiveAudio.hasAudioForMessage?.(messageId)) {
                console.log(`🎯 Voice Mode TTS: First sentence audio ready after ${(retries + 1) * 500}ms, starting playback for message ${messageId}`);
                if (progressiveAudio.startPlaybackForMessage) {
                  await progressiveAudio.startPlaybackForMessage(messageId);
                  console.log(`🎯 Voice Mode TTS: Playback started successfully for message ${messageId}`);
                }
                
                // Update voice mode context if in voice mode
                if (isVoiceConversationMode && setCurrentPlayingMessageId) {
                  setCurrentPlayingMessageId(messageId);
                }
                
                return;
              }
              
              retries++;
              console.log(`🎯 Voice Mode TTS: Waiting for first sentence audio... attempt ${retries}/${maxRetries}`);
            }
            
            console.warn(`🎯 Voice Mode TTS: Timeout waiting for first sentence audio for message ${messageId}, falling back`);
          } else {
            console.log(`🎯 Voice Mode TTS: On-demand generation failed for message ${messageId}, falling back to traditional TTS`);
          }
        } catch (err) {
          console.warn(`🎯 Voice Mode TTS: On-demand generation error for message ${messageId}:`, err);
        }
      } else if (!isVoiceConversationMode) {
        // 🎯 ON-DEMAND GENERATION: For text/dictation mode, try to generate Progressive TTS
        console.log(`🎯 Progressive TTS: No existing audio for message ${messageId}, attempting on-demand generation (text/dictation mode)`);
        
        try {
          const generationSuccess = await generateProgressiveTTSOnDemand();
          
          if (generationSuccess) {
            // Wait for first sentence audio to actually be available
            let retries = 0;
            const maxRetries = 20; // Wait up to 10 seconds (20 * 500ms)
            
            while (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500));
              
              if (progressiveAudio.hasAudioForMessage?.(messageId)) {
                console.log(`🎯 Progressive TTS: First sentence audio ready after ${(retries + 1) * 500}ms, starting auto-playback for message ${messageId} (text/dictation mode)`);
                if (progressiveAudio.startPlaybackForMessage) {
                  await progressiveAudio.startPlaybackForMessage(messageId);
                  console.log(`🎯 Progressive TTS: Auto-playback started successfully for message ${messageId}`);
                }
                
                // Update voice mode context if in voice mode
                if (isVoiceConversationMode && setCurrentPlayingMessageId) {
                  setCurrentPlayingMessageId(messageId);
                }
                
                // Reset requested state since playback started successfully
                console.log(`🎯 Progressive TTS: Auto-playback completed setup for message ${messageId}`);
                return;
              }
              
              retries++;
              console.log(`🎯 Progressive TTS: Waiting for first sentence audio... attempt ${retries}/${maxRetries}`);
            }
            
            console.warn(`🎯 Progressive TTS: Timeout waiting for first sentence audio for message ${messageId}, falling back`);
          } else {
            console.log(`🎯 Progressive TTS: On-demand generation failed for message ${messageId}, falling back to traditional TTS`);
          }
        } catch (err) {
          console.warn(`🎯 Progressive TTS: On-demand generation error for message ${messageId}:`, err);
        }
      } else {
        console.log(`🎯 Progressive TTS: No progressive audio found for message ${messageId} (voice mode), checking alternatives`);
      }
    }
    
    if (isVoiceConversationMode && getAudio && setCurrentPlayingMessageId) {
      // Voice mode: Use shared audio if available (backup method)
      const sharedAudio = getAudio(messageId);
      if (sharedAudio) {
        console.log(`Using shared audio for message ${messageId} in voice mode`);
        try {
          setError(null);
          setCurrentPlayingMessageId(messageId);
          await sharedAudio.play();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Shared audio playback error';
          console.error(`Shared audio playback error for message ${messageId}:`, err);
          setError(errorMessage);
          setCurrentPlayingMessageId(null);
        }
        return;
      } else {
        console.log(`No shared audio found for message ${messageId}, falling back to generation`);
      }
    }
    
    // Text mode or final fallback: Use local audio generation/playback
    console.log(`🎯 Fallback: Using traditional TTS generation for message ${messageId}`);
    await playLocalAudio(blobToPlay);
  }, [isVoiceConversationMode, getAudio, setCurrentPlayingMessageId, messageId, playLocalAudio, generateProgressiveTTSOnDemand]);
  
  // Stop audio playback - handles Progressive TTS, shared audio, and local
  const stopAudio = useCallback(() => {
    console.log(`🛑 Stopping audio for message ${messageId.substring(0, 8)}, current playing state: ${isPlaying}`);
    
    // 🚀 PROGRESSIVE TTS PRIORITY: Stop Progressive TTS first
    const conversationManager = window.sonoriaPlugin?.conversationManager as ConversationManagerWithProgressiveTTS | undefined;
    if (conversationManager && conversationManager.progressiveAudioPlayback) {
      const progressiveAudio = conversationManager.progressiveAudioPlayback;
      
      // Check if Progressive TTS is playing this message
      if (progressiveAudio.isPlayingMessage && progressiveAudio.isPlayingMessage(messageId)) {
        console.log(`🎯 Progressive TTS: Stopping progressive audio for message ${messageId}`);
        try {
          if (progressiveAudio.stopPlaybackForMessage) {
            progressiveAudio.stopPlaybackForMessage(messageId);
          }
          
          // 🔧 VOICE MODE FIX: Force reset all progressive TTS state after stopping for clean next interaction
          setProgressiveTTSPlaying(false);
          setProgressiveTTSRequested(false);
          setIsGeneratingProgressiveTTS(false);
          
          // Update voice mode context if in voice mode
          if (isVoiceConversationMode && setCurrentPlayingMessageId && currentPlayingMessageId === messageId) {
            setCurrentPlayingMessageId(null);
          }
          
          console.log(`🔧 Progressive TTS: All state reset for message ${messageId} - ready for next interaction`);
          return;
        } catch (err) {
          console.warn(`Progressive TTS stop failed for message ${messageId}:`, err);
          // Force reset state even if stop failed
          setProgressiveTTSPlaying(false);
          setProgressiveTTSRequested(false);
          setIsGeneratingProgressiveTTS(false);
          // Fall through to backup methods
        }
      }
    }
    
    if (isVoiceConversationMode && getAudio && setCurrentPlayingMessageId && currentPlayingMessageId === messageId) {
      // Voice mode: Stop shared audio (backup method)
      const sharedAudio = getAudio(messageId);
      if (sharedAudio) {
        try {
          sharedAudio.pause();
          setCurrentPlayingMessageId(null);
          console.log(`Stopped shared audio for message ${messageId}`);
          return;
        } catch (err) {
          console.warn(`Error stopping shared audio for message ${messageId}:`, err);
        }
      }
    }
    
    // Text mode or final fallback: Stop local audio
    try {
      if (localAudioRef.current) {
        const audio = localAudioRef.current;
        
        // Only try to pause if the audio is in a valid state and actually playing
        if (audio.readyState >= 1 && !audio.paused && !audio.ended) {
          try {
            audio.pause();
            console.log(`Local audio playback stopped for message ${messageId}`);
          } catch (pauseErr) {
            console.warn(`Local audio pause error for message ${messageId}:`, pauseErr);
          }
        } else {
          console.log(`Local audio already stopped or not ready for message ${messageId}`);
        }
      }
    } catch (err) {
      console.warn(`Audio stop warning for message ${messageId}:`, err);
    } finally {
      // Always cleanup local audio regardless of pause success/failure
      cleanup();
    }
  }, [isVoiceConversationMode, getAudio, setCurrentPlayingMessageId, currentPlayingMessageId, messageId, cleanup, isPlaying]);
  
  // Generate TTS and play immediately (primarily for text mode)
  const generateAndPlay = useCallback(async (): Promise<void> => {
    const blob = await generateTTS();
    if (blob) {
      await playLocalAudio(blob);
    }
  }, [generateTTS, playLocalAudio]);
  
  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    // State
    isGenerating: isGenerating || isGeneratingProgressiveTTS,
    isPlaying,
    hasAudio,
    error,
    
    // Controls
    playAudio,
    stopAudio,
    generateAndPlay,
    clearError
  };
}; 