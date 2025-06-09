import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { VoiceMode, VoiceInteractionState } from './VoiceContext';
import type { VoiceModeContextType } from './VoiceContext';

// Audio storage interface for sharing TTS audio between components
interface AudioStorage {
  [messageId: string]: {
    blob: Blob;
    audio: HTMLAudioElement;
    objectUrl: string;
  };
}

// Enhanced context type with audio storage
interface EnhancedVoiceModeContextType extends VoiceModeContextType {
  // Audio storage methods
  storeAudio: (messageId: string, audioBlob: Blob) => HTMLAudioElement;
  getAudio: (messageId: string) => HTMLAudioElement | null;
  removeAudio: (messageId: string) => void;
  clearAllAudio: () => void;
  // Current playing audio tracking
  currentPlayingMessageId: string | null;
  setCurrentPlayingMessageId: (messageId: string | null) => void;
}

// Create the Voice Mode Context
const VoiceModeContext = createContext<EnhancedVoiceModeContextType | undefined>(undefined);

interface VoiceModeProviderProps {
  children: ReactNode;
}

/**
 * VoiceModeProvider manages the overall voice interaction mode state
 * and provides shared audio storage for TTS audio blobs
 */
export const VoiceModeProvider: React.FC<VoiceModeProviderProps> = ({ children }) => {
  // Voice mode state - controls overall interaction pattern
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(VoiceMode.TEXT_ONLY);
  
  // Voice interaction state - tracks current operation (recording, processing, etc.)
  const [voiceState, setVoiceState] = useState<VoiceInteractionState>(VoiceInteractionState.VOICE_IDLE);
  
  // Track previous mode for returning from dictation
  const [previousMode, setPreviousMode] = useState<VoiceMode>(VoiceMode.TEXT_ONLY);

  // Audio storage for sharing TTS audio between voice mode and per-message controls
  const audioStorageRef = useRef<AudioStorage>({});
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<string | null>(null);

  // Computed properties for convenience
  const isVoiceConversationMode = voiceMode === VoiceMode.VOICE_CONVERSATION;
  const isDictationMode = voiceMode === VoiceMode.DICTATION;

  // 🎯 PROGRESSIVE TTS INTEGRATION: Sync voice mode state globally
  // This allows ConversationManager to access voice mode state for Progressive TTS
  useEffect(() => {
    (window as unknown as { sonoriaVoiceConversationMode?: boolean }).sonoriaVoiceConversationMode = isVoiceConversationMode;
    console.log(`🔄 VoiceModeContext: Global voice conversation mode set to ${isVoiceConversationMode}`);
  }, [isVoiceConversationMode]);

  // Audio storage methods
  const storeAudio = useCallback((messageId: string, audioBlob: Blob): HTMLAudioElement => {
    // Clean up any existing audio for this message
    if (audioStorageRef.current[messageId]) {
      const existing = audioStorageRef.current[messageId];
      existing.audio.pause();
      URL.revokeObjectURL(existing.objectUrl);
    }

    // Create new audio element and object URL
    const objectUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(objectUrl);
    
    // Store in our audio storage
    audioStorageRef.current[messageId] = {
      blob: audioBlob,
      audio: audio,
      objectUrl: objectUrl
    };

    console.log(`VoiceModeContext: Stored audio for message ${messageId}, blob size: ${audioBlob.size} bytes`);
    return audio;
  }, []);

  const getAudio = useCallback((messageId: string): HTMLAudioElement | null => {
    const stored = audioStorageRef.current[messageId];
    if (stored) {
      console.log(`VoiceModeContext: Retrieved stored audio for message ${messageId}`);
      return stored.audio;
    }
    console.log(`VoiceModeContext: No stored audio found for message ${messageId}`);
    return null;
  }, []);

  const removeAudio = useCallback((messageId: string) => {
    const stored = audioStorageRef.current[messageId];
    if (stored) {
      stored.audio.pause();
      URL.revokeObjectURL(stored.objectUrl);
      delete audioStorageRef.current[messageId];
      console.log(`VoiceModeContext: Removed audio for message ${messageId}`);
      
      // Clear current playing if it was this message
      if (currentPlayingMessageId === messageId) {
        setCurrentPlayingMessageId(null);
      }
    }
  }, [currentPlayingMessageId]);

  const clearAllAudio = useCallback(() => {
    Object.keys(audioStorageRef.current).forEach(messageId => {
      const stored = audioStorageRef.current[messageId];
      stored.audio.pause();
      URL.revokeObjectURL(stored.objectUrl);
    });
    audioStorageRef.current = {};
    setCurrentPlayingMessageId(null);
    console.log('VoiceModeContext: Cleared all stored audio');
  }, []);

  // Mode transition handlers
  const toggleVoiceConversationMode = useCallback(() => {
    console.log(`🔄 toggleVoiceConversationMode called: current voiceMode=${voiceMode}`);
    console.log(`🔄 Voice mode constants: TEXT_ONLY=${VoiceMode.TEXT_ONLY}, VOICE_CONVERSATION=${VoiceMode.VOICE_CONVERSATION}`);
    
    if (voiceMode === VoiceMode.VOICE_CONVERSATION) {
      console.log('🔄 Switching FROM voice conversation TO text mode');
      setVoiceMode(VoiceMode.TEXT_ONLY);
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
      // Clear audio when exiting voice mode
      clearAllAudio();
    } else {
      console.log('🔄 Switching FROM text/other mode TO voice conversation');
      setPreviousMode(voiceMode);
      setVoiceMode(VoiceMode.VOICE_CONVERSATION);
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
    }
    console.log('🔄 toggleVoiceConversationMode completed');
  }, [voiceMode, clearAllAudio]);

  const startDictationMode = useCallback(() => {
    if (voiceMode !== VoiceMode.DICTATION) {
      setPreviousMode(voiceMode);
      setVoiceMode(VoiceMode.DICTATION);
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
    }
  }, [voiceMode]);

  const endDictationMode = useCallback(() => {
    console.log(`🔚 endDictationMode called: current voiceMode=${voiceMode}, isDictationMode=${isDictationMode}`);
    if (voiceMode === VoiceMode.DICTATION) {
      console.log('🔚 Ending dictation mode - returning to TEXT_ONLY');
      // Always return to text mode after dictation
      setVoiceMode(VoiceMode.TEXT_ONLY);
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
      console.log('🔚 Dictation mode ended successfully');
    } else {
      console.log(`🔚 Not in dictation mode (voiceMode=${voiceMode}), no action needed`);
    }
  }, [voiceMode, isDictationMode]);

  // Enhanced setVoiceMode with mode tracking
  const handleSetVoiceMode = useCallback((mode: VoiceMode) => {
    if (mode !== VoiceMode.DICTATION) {
      setPreviousMode(voiceMode);
    }
    setVoiceMode(mode);
    
    // Reset voice state when changing modes
    if (mode === VoiceMode.TEXT_ONLY) {
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
      // Clear audio when switching to text mode
      clearAllAudio();
    }
  }, [voiceMode, clearAllAudio]);

  const contextValue: EnhancedVoiceModeContextType = {
    voiceMode,
    setVoiceMode: handleSetVoiceMode,
    voiceState,
    setVoiceState,
    isVoiceConversationMode,
    isDictationMode,
    toggleVoiceConversationMode,
    startDictationMode,
    endDictationMode,
    previousMode,
    // Audio storage methods
    storeAudio,
    getAudio,
    removeAudio,
    clearAllAudio,
    currentPlayingMessageId,
    setCurrentPlayingMessageId,
  };

  return (
    <VoiceModeContext.Provider value={contextValue}>
      {children}
    </VoiceModeContext.Provider>
  );
};

/**
 * Hook to access voice mode context
 * Provides comprehensive voice mode management functions
 */
export const useVoiceMode = (): EnhancedVoiceModeContextType => {
  const context = useContext(VoiceModeContext);
  if (context === undefined) {
    throw new Error('useVoiceMode must be used within a VoiceModeProvider');
  }
  return context;
};

/**
 * Hook for components that only need to check voice mode without full management
 */
export const useVoiceModeCheck = () => {
  const { voiceMode, isVoiceConversationMode, isDictationMode } = useVoiceMode();
  return {
    voiceMode,
    isVoiceConversationMode,
    isDictationMode,
    // Only voice conversation mode should show voice input area, not dictation
    isVoiceMode: isVoiceConversationMode,
  };
}; 