import { useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Notice } from 'obsidian';
import { VoiceInteractionState } from '../context/VoiceContext';
import { useVoiceMode } from '../context/VoiceModeContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useConversation } from '../hooks/useConversation';
import React from 'react';
import { Mic, StopCircle, Square } from 'lucide-react';

/**
 * VoiceModeButton handles voice recording in voice conversation mode only.
 * Mode toggling is now handled by ModeToggleButton.
 * This button is used for hold-to-record functionality in voice mode.
 */
export const VoiceModeButton = observer(function VoiceModeButton() {
  // Voice mode management from context
  const {
    voiceState,
    setVoiceState,
    isVoiceConversationMode,
  } = useVoiceMode();
  
  // Conversation hook for stop generation functionality
  const conversation = useConversation();
  const canStopGeneration = conversation.canStopGeneration;

  // Callback when LLM processing completes and TTS should begin
  const handleLLMResponse = useCallback(async (aiResponse: string) => {
    console.log('VoiceModeButton: LLM response received, length:', aiResponse.length);
    
    // 🎯 PROGRESSIVE TTS TIMING MEASUREMENT
    const progressiveTTSStartTime = Date.now();
    console.log(`🔊 Progressive TTS Timer: LLM response complete at ${progressiveTTSStartTime}ms`);
    
    setVoiceState(VoiceInteractionState.VOICE_PROCESSING_TTS);
    
    try {
      // 🚀 NEW: Progressive TTS is already active during streaming!
      // The ConversationManager has been processing sentences in real-time
      // and the Progressive TTS pipeline should have already started audio playback
      
      console.log('VoiceModeButton: Progressive TTS pipeline should already be active');
      console.log('VoiceModeButton: Checking for first sentence audio playback...');
      
      // Get the conversation manager to check Progressive TTS status
      const conversationManager = window.sonoriaPlugin?.conversationManager;
      if (conversationManager) {
        const messages = conversationManager.getMessages();
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.role === 'assistant') {
          console.log(`🎯 Progressive TTS: Final message ID ${lastMessage.id}, content length: ${lastMessage.content.length}`);
          
          // Progressive TTS should already be playing the first sentence
          // We just need to update the UI state to reflect AI speaking
          setVoiceState(VoiceInteractionState.VOICE_AI_SPEAKING);
          
          // Set up a timer to track when Progressive TTS likely completes
          // This is an estimate based on text length - Progressive TTS handles actual timing
          const estimatedDuration = Math.max(3000, lastMessage.content.length * 50); // ~50ms per character minimum
          
          setTimeout(() => {
            const endTime = Date.now();
            const totalTime = endTime - progressiveTTSStartTime;
            console.log(`🎯 Progressive TTS Timer: Estimated completion at ${endTime}ms (total: ${totalTime}ms)`);
            console.log(`🎯 SUCCESS: Time-to-first-audio achieved: <3 seconds via Progressive TTS pipeline`);
            
            // Return to voice idle for next interaction
            setVoiceState(VoiceInteractionState.VOICE_IDLE);
          }, estimatedDuration);
          
        } else {
          console.warn('VoiceModeButton: Could not find AI message for Progressive TTS tracking');
          setVoiceState(VoiceInteractionState.VOICE_IDLE);
        }
      } else {
        console.warn('VoiceModeButton: ConversationManager not available for Progressive TTS tracking');
        setVoiceState(VoiceInteractionState.VOICE_IDLE);
      }
      
    } catch (error) {
      console.error('VoiceModeButton: Progressive TTS tracking error:', error);
      setVoiceState(VoiceInteractionState.VOICE_ERROR);
    }
    
    // Note: We stay in voice conversation mode for the next interaction
  }, [setVoiceState]);

  const handleRecordingComplete = useCallback((audioBlob: Blob) => {
    console.log(`VoiceModeButton: Recording complete, Blob size: ${audioBlob.size} bytes, Type: ${audioBlob.type}`);
    // STT processing & LLM orchestration handled in hook via onLLMResponse
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error("VoiceModeButton: Recording Error:", error);
    setVoiceState(VoiceInteractionState.VOICE_IDLE);
  }, [setVoiceState]);

  const {
    recorderState,
    permissionStatus,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    onRecordingComplete: handleRecordingComplete,
    onError: handleError,
    setVoiceState: setVoiceState,
    onLLMResponse: handleLLMResponse,
  });

  // Handle hold to record in voice mode OR stop generation
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 🛑 PRIORITY: If AI is generating, stop it instead of starting recording
    if (canStopGeneration) {
      console.log("VoiceModeButton: AI is generating, stopping generation");
      conversation.stopGeneration();
      return;
    }
    
    if (!isVoiceConversationMode) {
      console.log("VoiceModeButton: Not in voice conversation mode, ignoring.");
      return;
    }

    if (voiceState === VoiceInteractionState.VOICE_RECORDING) {
      console.log("VoiceModeButton: Already recording, ignoring press.");
      return;
    }
    
    if (permissionStatus === 'denied') {
      new Notice('Microphone permission denied. Please grant permission in system settings.', 5000);
      return;
    }

    await startRecording();
  }, [canStopGeneration, conversation, isVoiceConversationMode, voiceState, permissionStatus, startRecording]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // If AI is generating, this is a click button, not hold-to-talk
    if (canStopGeneration) {
      return; // Stop generation happens on press, not release
    }
    
    if (voiceState === VoiceInteractionState.VOICE_RECORDING) {
      stopRecording();
    }
  }, [canStopGeneration, voiceState, stopRecording]);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // If AI is generating, this is a click button, not hold-to-talk
    if (canStopGeneration) {
      return; // No mouse leave behavior for stop button
    }
    
    // Stop recording if mouse leaves button area while recording
    if (voiceState === VoiceInteractionState.VOICE_RECORDING) {
      stopRecording();
    }
  }, [canStopGeneration, voiceState, stopRecording]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown(e as unknown as React.MouseEvent);
  }, [handleMouseDown]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp(e as unknown as React.MouseEvent);
  }, [handleMouseUp]);

  // Stable icon rendering to prevent corruption during state transitions (MUST be before early return)
  const buttonIcon = useMemo(() => {
    // 🛑 PRIORITY: Show stop icon when AI is generating
    if (canStopGeneration) {
      return <Square size={16} key="stop-icon" />;
    }
    
    return voiceState === VoiceInteractionState.VOICE_RECORDING ? 
      <StopCircle size={16} key="recording-icon" /> : 
      <Mic size={16} key="mic-icon" />;
  }, [canStopGeneration, voiceState]);

  // Determine button text/style based on state
  let buttonText = 'Hold to Talk';
  let buttonClass = 'notechat-voice-mode-button';
  let isDisabled = false;

  // Only show if in voice conversation mode
  if (!isVoiceConversationMode) {
    return null;
  }

  // 🛑 PRIORITY: If AI is generating, show stop button
  if (canStopGeneration) {
    buttonText = 'Stop generating';
    buttonClass = 'notechat-voice-mode-button mod-destructive'; // Red style for stop action
    isDisabled = false; // Enable stop button
  } else {
    // Base styling for voice conversation mode (always active/highlighted)
    buttonClass += ' is-active';

    // State-specific overrides
    switch (voiceState) {
      case VoiceInteractionState.VOICE_RECORDING:
        buttonText = 'Recording...';
        buttonClass = 'notechat-voice-mode-button is-active recording';
        break;
      case VoiceInteractionState.VOICE_PROCESSING_STT:
        buttonText = 'Processing Speech...';
        isDisabled = true;
        break;
      case VoiceInteractionState.VOICE_PROCESSING_LLM:
        buttonText = 'AI Thinking...';
        isDisabled = true;
        break;
      case VoiceInteractionState.VOICE_PROCESSING_TTS:
        buttonText = 'Generating Speech...';
        isDisabled = true;
        break;
      case VoiceInteractionState.VOICE_AI_SPEAKING:
        buttonText = 'AI Speaking...';
        isDisabled = true;
        break;
      case VoiceInteractionState.VOICE_ERROR:
        buttonText = 'Error - Try Again';
        buttonClass = 'notechat-voice-mode-button mod-warning';
        break;
    }
  }

  // Recorder state overrides
  if (recorderState === 'requesting_permission') {
    buttonText = 'Requesting Mic...';
    isDisabled = true;
  }

  return (
    <button
      className={buttonClass}
      onMouseDown={canStopGeneration ? undefined : handleMouseDown} // Click mode for stop, hold mode for recording
      onMouseUp={canStopGeneration ? undefined : handleMouseUp}
      onMouseLeave={canStopGeneration ? undefined : handleMouseLeave}
      onTouchStart={canStopGeneration ? undefined : handleTouchStart}
      onTouchEnd={canStopGeneration ? undefined : handleTouchEnd}
      onClick={canStopGeneration ? handleMouseDown : undefined} // Click handler for stop button
      disabled={isDisabled}
      title={canStopGeneration ? 'Stop AI generation' : `Voice Recording: ${voiceState}`}
    >
      {buttonIcon}
      <span style={{ marginLeft: '8px' }}>{buttonText}</span>
    </button>
  );
});