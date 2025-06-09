import { useCallback, useRef, useEffect } from 'react';
import { Notice } from 'obsidian';
import { VoiceMode, VoiceInteractionState } from '../context/VoiceContext';
import { useVoiceMode } from '../context/VoiceModeContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import React from 'react';
import { Mic, Keyboard } from 'lucide-react';

/**
 * Unified mode toggle button that adapts behavior based on current voice mode:
 * - Text Mode: Mic icon, Click = Voice Conversation Mode, Hold = Dictation
 * - Voice Mode: Keyboard icon, Click = Text Mode, Hold = Disabled
 */
export function ModeToggleButton() {
  // Voice mode management from context
  const {
    voiceMode,
    setVoiceMode,
    voiceState,
    setVoiceState,
    isVoiceConversationMode,
    isDictationMode,
    toggleVoiceConversationMode,
    startDictationMode,
    endDictationMode,
  } = useVoiceMode();

  // Hold detection refs for click vs hold behavior
  const isHoldingRef = useRef(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const HOLD_THRESHOLD = 800; // ms - time to distinguish click from hold (increased for better UX)
  const CLICK_DEBOUNCE = 200; // ms - prevent rapid double clicks

  // Handle LLM responses for dictation mode
  const handleLLMResponse = useCallback((_userTranscript: string, _aiResponse: string, _threadId: string | null) => {
    console.log('ModeToggleButton: Received LLM response');
    
    // NOTE: Do NOT call addTurnToConversation here as it would create duplicates!
    // The message is already added by the normal sendMessage() flow in useAudioRecorder
    // This callback is only for handling mode-specific post-processing (like TTS in voice mode)
    
    // For dictation mode, return to text mode after completion
    if (isDictationMode) {
      console.log('ModeToggleButton: Delaying endDictationMode to allow auto-folding to work');
      // CRITICAL FIX: Delay ending dictation mode to allow the AI message to render with forceCollapsed=true
      // The auto-folding logic depends on isDictationMode being true when the message renders
      setTimeout(() => {
        console.log('ModeToggleButton: endDictationMode called from handleLLMResponse (delayed)');
        endDictationMode();
      }, 500); // 500ms delay to ensure the AI message renders with proper forceCollapsed state
    } else {
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
    }
  }, [isDictationMode, endDictationMode, setVoiceState]);

  const handleRecordingComplete = useCallback((audioBlob: Blob) => {
    console.log(`ModeToggleButton: Recording complete, Blob size: ${audioBlob.size} bytes, Type: ${audioBlob.type}`);
    // STT processing & LLM orchestration handled in hook via onLLMResponse
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error("ModeToggleButton: Recording Error:", error);
    // Reset to appropriate state based on current mode
    if (isDictationMode) {
      console.log('ModeToggleButton: endDictationMode called from handleError');
      endDictationMode();
    } else {
      setVoiceState(VoiceInteractionState.VOICE_IDLE);
    }
  }, [isDictationMode, endDictationMode, setVoiceState]);

  const {
    recorderState,
    permissionStatus,
    startRecording,
    stopRecording,
    cleanup,
  } = useAudioRecorder({
    onRecordingComplete: handleRecordingComplete,
    onError: handleError,
    setVoiceState: setVoiceState,
    onLLMResponse: handleLLMResponse,
  });

  // Simple click handler - NO HOLD LOGIC HERE
  const handleClick = useCallback(() => {
    console.log(`🖱️ handleClick called: voiceMode=${voiceMode}, isVoiceConversationMode=${isVoiceConversationMode}, isDictationMode=${isDictationMode}`);
    console.log(`🖱️ Voice mode constants: TEXT_ONLY=${VoiceMode.TEXT_ONLY}, VOICE_CONVERSATION=${VoiceMode.VOICE_CONVERSATION}, DICTATION=${VoiceMode.DICTATION}`);
    
    if (voiceMode === VoiceMode.TEXT_ONLY) {
      // Text mode: Click to enter voice conversation mode
      console.log('🖱️ ModeToggleButton: Click in text mode - entering voice conversation mode');
      console.log('🖱️ About to call toggleVoiceConversationMode()');
      toggleVoiceConversationMode();
      console.log('🖱️ toggleVoiceConversationMode() called');
    } else if (isVoiceConversationMode) {
      // Voice mode: Click to exit to text mode
      console.log('🖱️ ModeToggleButton: Click in voice mode - returning to text mode');
      console.log('🖱️ About to call toggleVoiceConversationMode()');
      toggleVoiceConversationMode();
      console.log('🖱️ toggleVoiceConversationMode() called');
    } else if (isDictationMode) {
      // Dictation mode: Click to force reset and enter voice conversation mode
      console.log('🖱️ ModeToggleButton: Click in dictation mode - force resetting to voice conversation mode');
      console.log('🖱️ About to call endDictationMode() and then directly set voice conversation mode');
      endDictationMode(); // This should return to TEXT_ONLY
      
      // Force set to voice conversation mode using setVoiceMode directly
      console.log('🖱️ About to force set VOICE_CONVERSATION mode');
      setVoiceMode(VoiceMode.VOICE_CONVERSATION);
      console.log('🖱️ Dictation mode click handled - forced to voice conversation');
    } else {
      console.log(`🖱️ Unexpected state: voiceMode=${voiceMode}, isVoiceConversationMode=${isVoiceConversationMode}, isDictationMode=${isDictationMode}`);
    }
  }, [voiceMode, isVoiceConversationMode, isDictationMode, toggleVoiceConversationMode, endDictationMode, setVoiceMode]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
      if (clickDebounceRef.current) {
        clearTimeout(clickDebounceRef.current);
      }
    };
  }, []);

  // REMOVED: handleHoldStart - now using immediate recording in mouseDown

  // Simple hold end - like HoldToTalkButton handleRelease
  const handleHoldEnd = useCallback(() => {
    console.log(`ModeToggleButton: Hold end - stopping dictation recording, voiceState: ${voiceState}, isDictationMode: ${isDictationMode}, recorderState: ${recorderState}`);
    
    // Only attempt to stop if we are actually in the recording state
    if (voiceState === VoiceInteractionState.VOICE_RECORDING) {
      console.log('ModeToggleButton: Calling stopRecording()');
      stopRecording();
    } else {
      console.log(`ModeToggleButton: Not recording (voiceState: ${voiceState}), just resetting dictation mode`);
      if (isDictationMode) {
        console.log('ModeToggleButton: Calling cleanup() and endDictationMode()');
        cleanup(); // Clean up any leftover recorder state
        endDictationMode();
      }
    }
  }, [voiceState, stopRecording, isDictationMode, endDictationMode, recorderState, cleanup]);

  // Mouse down handler - sets up click vs hold detection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log(`🔽 ModeToggleButton: mouseDown event, voiceMode: ${voiceMode}, voiceState: ${voiceState}, button: ${e.button}, detail: ${e.detail}`);
    e.preventDefault();
    e.stopPropagation();
    
    if (voiceMode !== VoiceMode.TEXT_ONLY && voiceMode !== VoiceMode.DICTATION) {
      console.log('ModeToggleButton: Not in text/dictation mode, ignoring mouseDown');
      return; // Only handle clicks/holds in text/dictation modes
    }

    isHoldingRef.current = false;
    
    // Set up hold detection timer
    holdTimeoutRef.current = setTimeout(async () => {
      console.log('ModeToggleButton: Hold threshold reached - starting dictation');
      isHoldingRef.current = true;
      
      // Only start dictation if we're in text mode and not already recording
      if (voiceMode === VoiceMode.TEXT_ONLY && voiceState !== VoiceInteractionState.VOICE_RECORDING) {
        if (permissionStatus === 'denied') {
          new Notice('Microphone permission denied. Please grant permission in system settings.', 5000);
          return;
        }

        // Start dictation mode
        startDictationMode();
        
        // Start recording for dictation
        try {
          console.log('ModeToggleButton: Starting dictation recording');
          await startRecording();
          console.log('ModeToggleButton: Dictation recording started successfully');
        } catch (error) {
          console.error('ModeToggleButton: Failed to start dictation recording', error);
          endDictationMode();
          new Notice('Failed to start recording. Please check microphone permissions.', 3000);
        }
      }
    }, HOLD_THRESHOLD);
  }, [voiceMode, voiceState, permissionStatus, startDictationMode, startRecording, endDictationMode]);

  // Mouse up handler - handles both click and hold end
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    console.log(`🔼 ModeToggleButton: mouseUp event, voiceMode: ${voiceMode}, voiceState: ${voiceState}, isHolding: ${isHoldingRef.current}, button: ${e.button}, detail: ${e.detail}`);
    e.preventDefault();
    e.stopPropagation();
    
    if (voiceMode !== VoiceMode.TEXT_ONLY && voiceMode !== VoiceMode.DICTATION) {
      console.log('ModeToggleButton: Not in text/dictation mode, ignoring mouseUp');
      return;
    }

    // Clear the hold timeout if it's still pending
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (isHoldingRef.current) {
      // Was holding - end dictation recording
      console.log('ModeToggleButton: Ending hold (dictation recording)');
      handleHoldEnd();
    } else {
      // Was a click - toggle voice conversation mode (with debounce)
      console.log('🔼 ModeToggleButton: Processing click (toggle voice conversation mode)');
      
      // Clear any previous debounce timeout
      if (clickDebounceRef.current) {
        console.log('🔼 Clearing previous click debounce timeout');
        clearTimeout(clickDebounceRef.current);
      }
      
      // Debounce the click to prevent rapid double-toggles
      clickDebounceRef.current = setTimeout(() => {
        console.log('🔼 Debounced click executing...');
        handleClick();
        clickDebounceRef.current = null;
      }, CLICK_DEBOUNCE);
    }
    
    isHoldingRef.current = false;
  }, [voiceMode, voiceState, handleHoldEnd, handleClick]);

  // Mouse leave handler - treat as release if holding/recording
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    console.log(`ModeToggleButton: Mouse leave event, voiceMode: ${voiceMode}, voiceState: ${voiceState}, isHolding: ${isHoldingRef.current}`);
    e.preventDefault();
    
    // Clear any pending hold timeout
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    // If we were holding and recording, end the recording
    if ((voiceMode === VoiceMode.TEXT_ONLY || voiceMode === VoiceMode.DICTATION) && 
        (isHoldingRef.current || voiceState === VoiceInteractionState.VOICE_RECORDING)) {
      console.log('ModeToggleButton: Mouse left while holding/recording - ending recording');
      handleHoldEnd();
    }
    
    isHoldingRef.current = false;
  }, [voiceMode, voiceState, handleHoldEnd]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown(e as unknown as React.MouseEvent);
  }, [handleMouseDown]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp(e as unknown as React.MouseEvent);
  }, [handleMouseUp]);

  // Simple click handler for voice mode (no hold behavior)
  const handleSimpleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    handleClick();
  }, [handleClick]);

  // Minimal logging for debugging mode changes
  // console.log(`ModeToggleButton render: voiceMode=${voiceMode}, isVoiceConversationMode=${isVoiceConversationMode}, isDictationMode=${isDictationMode}`);

  // Determine button appearance and behavior based on mode
  let buttonIcon: React.ReactNode;
  let buttonText: string;
  let buttonClass = 'mode-toggle-button';
  let isDisabled = false;

  if (voiceMode === VoiceMode.TEXT_ONLY) {
    // Text mode: Mic icon, supports hold for dictation
    buttonIcon = <Mic size={16} />;
    buttonText = isDictationMode ? 'Dictating...' : 'Click: Voice Mode | Hold: Dictate';
    if (isDictationMode) {
      buttonClass += ' is-active';
    }
  } else if (isVoiceConversationMode) {
    // Voice conversation mode: Keyboard icon, click only
    buttonIcon = <Keyboard size={16} />;
    buttonText = ''; // No text in voice mode, just icon
  } else {
    // Fallback
    buttonIcon = <Mic size={16} />;
    buttonText = 'Mode Toggle';
  }

  // State-specific overrides for dictation
  if (isDictationMode) {
    switch (voiceState) {
      case VoiceInteractionState.VOICE_RECORDING:
        buttonText = 'Dictating...';
        buttonClass = 'mode-toggle-button is-active';
        break;
      case VoiceInteractionState.VOICE_PROCESSING_STT:
        buttonText = 'Processing Dictation...';
        isDisabled = true;
        break;
      case VoiceInteractionState.VOICE_PROCESSING_LLM:
        buttonText = 'AI Thinking...';
        isDisabled = true;
        break;
      case VoiceInteractionState.VOICE_ERROR:
        buttonText = 'Error - Try Again';
        buttonClass = 'mode-toggle-button mod-warning';
        break;
    }
  }

  // Recorder state overrides
  if (recorderState === 'requesting_permission') {
    buttonText = 'Requesting Mic...';
    isDisabled = true;
  }

  // Render button with mode-specific event handlers (direct assignment like HoldToTalkButton)
  // CRITICAL FIX: Both TEXT_ONLY and DICTATION should use hold behavior!
  if (voiceMode === VoiceMode.TEXT_ONLY || voiceMode === VoiceMode.DICTATION) {
    // Text mode OR dictation mode: Support hold for dictation
    return (
      <button
        className={buttonClass}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={isDisabled}
        title={buttonText}
      >
        <span className="mode-toggle-icon">{buttonIcon}</span>
        <span className="mode-toggle-text">{buttonText}</span>
      </button>
    );
  } else {
    // Voice conversation mode: Simple click only
    return (
      <button
        className={buttonClass}
        onClick={handleSimpleClick}
        disabled={isDisabled}
        title={buttonText}
      >
        <span className="mode-toggle-icon">{buttonIcon}</span>
        <span className="mode-toggle-text">{buttonText}</span>
      </button>
    );
  }
} 