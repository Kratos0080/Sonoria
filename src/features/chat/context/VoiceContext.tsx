// Remove unused import
// import { createContext } from 'react';
// Remove unused import
// import type { ReactNode } from 'react';

// Define the full set of voice interaction states based on Task 4.2
export enum VoiceInteractionState {
  VOICE_IDLE = 'idle',
  VOICE_RECORDING = 'recording',
  VOICE_PROCESSING_STT = 'processing_stt',
  VOICE_PROCESSING_LLM = 'processing_llm',
  VOICE_PROCESSING_TTS = 'processing_tts',
  VOICE_AI_SPEAKING = 'speaking', // Renamed from VOICE_SPEAKING for clarity
  VOICE_ERROR = 'error',
}

// New Voice Mode enum for Task 4.6 - manages overall interaction mode
export enum VoiceMode {
  TEXT_ONLY = 'text',           // Default mode - text input only
  VOICE_CONVERSATION = 'voice', // Toggle mode - persistent voice workflow
  DICTATION = 'dictation',      // Temporary mode - voice-to-text with auto-send
}

// Interface might still be useful for prop definitions
export interface VoiceContextType {
  voiceMode: boolean;
  setVoiceMode: (mode: boolean) => void;
  voiceState: VoiceInteractionState;
  setVoiceState: (state: VoiceInteractionState) => void;
}

// New Voice Mode Context interface for comprehensive voice mode management
export interface VoiceModeContextType {
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;
  voiceState: VoiceInteractionState;
  setVoiceState: (state: VoiceInteractionState) => void;
  isVoiceConversationMode: boolean;
  isDictationMode: boolean;
  toggleVoiceConversationMode: () => void;
  startDictationMode: () => void;
  endDictationMode: () => void;
  previousMode: VoiceMode; // For returning from dictation mode
}

// REMOVE Context Object and Provider
/*
export const VoiceContext = createContext<VoiceContextType | undefined>(undefined);
(VoiceContext as any)._debugId = `VoiceContext_${Date.now()}_${Math.random().toString(36).substring(7)}`;
console.log(`>>> VoiceContext Object Initialized | ID: ${(VoiceContext as any)._debugId}`);

interface VoiceProviderProps {
  children: ReactNode;
}
export function VoiceProvider({ children }: VoiceProviderProps) {
  // ... state logic ...
  console.log(`>>> VoiceProvider Component Rendering | Context ID: ${(VoiceContext as any)._debugId} | State: ${voiceState}`);
  const value = { ... };
  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}
*/

// REMOVE useVoiceContext hook
/*
export const useVoiceContext = (): VoiceContextType => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoiceContext must be used within a VoiceProvider');
  }
  return context;
};
*/ 