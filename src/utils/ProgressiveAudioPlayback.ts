/**
 * Progressive Audio Playback Manager
 * Handles sequence management and seamless transitions for sentence-level audio playback
 */
export class ProgressiveAudioPlayback {
  private audioSequences: Map<string, HTMLAudioElement[]> = new Map();
  private currentlyPlaying: Map<string, number> = new Map();
  private pausedAt: Map<string, number> = new Map(); // Track where each message was paused
  private objectUrls: Map<string, string[]> = new Map(); // Track object URLs for cleanup
  private eventListeners: Map<string, Map<number, {
    ended: () => void;
    error: (event: Event) => void;
    play: () => void;
    pause: () => void;
  }>> = new Map();
  
  // 🎯 AUTOPLAY FIX: Track user gesture establishment for autoplay permissions
  private audioContextReady: boolean = false;
  private userGestureEstablished: boolean = false;
  private audioContext: AudioContext | null = null;

  constructor() {
    // Establish user gesture event listeners when the class is created
    this.setupUserGestureDetection();
  }

  // 🎯 AUTOPLAY FIX: Set up user gesture detection for autoplay permissions
  private setupUserGestureDetection(): void {
    const establishGesture = () => {
      if (!this.userGestureEstablished) {
        console.log('🎯 ProgressiveAudio: User gesture established for autoplay');
        this.userGestureEstablished = true;
        this.initializeAudioContext();
      }
    };

    // Listen for various user interaction events to establish gesture
    document.addEventListener('click', establishGesture, { once: false });
    document.addEventListener('keydown', establishGesture, { once: false });
    document.addEventListener('touchstart', establishGesture, { once: false });
    document.addEventListener('mousedown', establishGesture, { once: false });
  }

  // 🎯 AUTOPLAY FIX: Initialize AudioContext to work around autoplay restrictions
  private async initializeAudioContext(): Promise<void> {
    if (this.audioContextReady) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if it starts in suspended state
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.audioContextReady = true;
      console.log('🎯 ProgressiveAudio: AudioContext initialized and ready for autoplay');
    } catch (error) {
      console.warn('🎯 ProgressiveAudio: Failed to initialize AudioContext:', error);
    }
  }

  // 🎯 AUTOPLAY FIX: Public method to establish user gesture (called from voice recording)
  public establishUserGesture(): void {
    if (!this.userGestureEstablished) {
      console.log('🎯 ProgressiveAudio: User gesture manually established via voice recording');
      this.userGestureEstablished = true;
      this.initializeAudioContext();
    }
  }

  /**
   * Queue sentence audio for progressive playback
   * @param audioBlob - The audio blob for this sentence
   * @param messageId - The message this audio belongs to
   * @param sequenceIndex - The position of this sentence in the message
   * @param isFirstSentence - Whether this is the first sentence
   * @param autoPlay - Whether to auto-start playback (only true in voice conversation mode)
   */
  async queueSentenceAudio(
    audioBlob: Blob, 
    messageId: string, 
    sequenceIndex: number,
    isFirstSentence: boolean,
    autoPlay: boolean = false
  ): Promise<void> {
    try {
      // Create audio element from blob
      const objectUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(objectUrl);
      
      // Initialize data structures for this message if needed
      if (!this.audioSequences.has(messageId)) {
        this.audioSequences.set(messageId, []);
        this.objectUrls.set(messageId, []);
        this.eventListeners.set(messageId, new Map());
      }
      
      const sequence = this.audioSequences.get(messageId);
      const urls = this.objectUrls.get(messageId);
      const listeners = this.eventListeners.get(messageId);
      
      if (!sequence || !urls || !listeners) {
        console.error(`Progressive Audio: Missing data structures for message ${messageId}`);
        return;
      }
      
      // Store the audio and URL at the correct sequence position
      sequence[sequenceIndex] = audio;
      urls[sequenceIndex] = objectUrl;
      
      // Set up event listeners for this audio element
      const audioListeners = {
        ended: () => this.playNextSentence(messageId),
        error: (event: Event) => this.handleAudioError(messageId, sequenceIndex, event),
        play: () => {
          console.log(`Progressive Audio: Started playing sentence ${sequenceIndex} for message ${messageId}`);
          // 🔧 IMMEDIATE STATE NOTIFICATION: Trigger immediate UI update when audio actually starts playing
          this.notifyPlaybackStateChange(messageId, 'playing');
        },
        pause: () => {
          console.log(`Progressive Audio: Paused sentence ${sequenceIndex} for message ${messageId}`);
          // 🔧 IMMEDIATE STATE NOTIFICATION: Trigger immediate UI update when audio pauses
          this.notifyPlaybackStateChange(messageId, 'paused');
        }
      };
      
      // Store listener references for cleanup
      listeners.set(sequenceIndex, audioListeners);
      
      // Add event listeners
      audio.addEventListener('ended', audioListeners.ended);
      audio.addEventListener('error', audioListeners.error);
      audio.addEventListener('play', audioListeners.play);
      audio.addEventListener('pause', audioListeners.pause);
      
      console.log(`Progressive Audio: Queued sentence ${sequenceIndex} for message ${messageId} (autoPlay: ${autoPlay})`);
      
      // Only auto-start playback if explicitly requested (voice conversation mode)
      if (autoPlay && isFirstSentence && sequenceIndex === 0 && !this.currentlyPlaying.has(messageId)) {
        console.log(`🔄 Progressive Audio: Auto-starting playback for first sentence in message ${messageId} (voice mode)`);
        console.log(`🎯 Progressive Audio: Autoplay status - userGestureEstablished: ${this.userGestureEstablished}, audioContextReady: ${this.audioContextReady}`);
        
        try {
          await this.startPlayback(messageId);
          console.log(`🔄 Progressive Audio: Auto-playback started successfully for message ${messageId}, currentlyPlaying state updated`);
          
          // 🔧 AUTO-PLAY STATE FIX: Immediate notification for button synchronization
          console.log(`🔄 Progressive Audio: State Details - isVoiceMode: true, isCurrentlyPlaying: ${this.currentlyPlaying.has(messageId)}, messageId: ${messageId.substring(0, 8)}`);
          // Trigger immediate state notification to ensure UI buttons sync immediately
          this.notifyPlaybackStateChange(messageId, 'auto-started');
        } catch (autoPlayError) {
          console.error(`Progressive Audio: Auto-playback failed for message ${messageId}:`, autoPlayError);
          // 🎯 AUTOPLAY FIX: If autoplay fails, ensure we notify the user
          if (!this.userGestureEstablished) {
            console.log(`🎯 Progressive Audio: Suggesting user interaction to enable autoplay`);
          }
        }
      } else if (isFirstSentence) {
        console.log(`🔄 Progressive TTS: First sentence ready for message ${messageId.substring(0, 8)}, waiting for manual play`);
        console.log(`Progressive Audio: autoPlay=${autoPlay}, sequenceIndex=${sequenceIndex}, currentlyPlaying=${this.currentlyPlaying.has(messageId)}`);
      }
      
    } catch (error) {
      console.error(`Progressive Audio: Error queuing sentence ${sequenceIndex} for message ${messageId}:`, error);
    }
  }

  /**
   * 🔧 IMMEDIATE STATE NOTIFICATION: Notify about playback state changes immediately
   * This helps the useTTSPlayback hook sync button states without waiting for polling
   */
  private notifyPlaybackStateChange(messageId: string, eventType: 'playing' | 'paused' | 'auto-started' | 'stopped'): void {
    console.log(`🔄 Progressive Audio: Immediate state notification - ${eventType} for message ${messageId.substring(0, 8)}`);
    
    // Trigger a custom event that the useTTSPlayback hook can listen to for immediate updates
    // This is more reliable than polling for fast state changes like auto-play start
    if (typeof window !== 'undefined') {
      const customEvent = new CustomEvent('progressiveTTSStateChange', {
        detail: {
          messageId,
          eventType,
          isPlaying: this.currentlyPlaying.has(messageId),
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(customEvent);
      console.log(`🔄 Progressive Audio: Dispatched state change event for message ${messageId.substring(0, 8)}: ${eventType}`);
    }
  }

  /**
   * Start playback for a message (plays the first available sentence)
   */
  private async startPlayback(messageId: string): Promise<void> {
    const sequence = this.audioSequences.get(messageId);
    if (!sequence || !sequence[0]) {
      console.warn(`Progressive Audio: No first sentence available for message ${messageId}`);
      return;
    }

    try {
      // 🎯 AUTOPLAY FIX: Ensure AudioContext is ready before attempting playback
      if (!this.audioContextReady) {
        await this.initializeAudioContext();
      }

      this.currentlyPlaying.set(messageId, 0);
      
      // 🎯 AUTOPLAY FIX: Enhanced play() with better error handling for autoplay restrictions
      const audio = sequence[0];
      
      // Set volume to ensure audio is audible
      audio.volume = 0.8;
      
      try {
        await audio.play();
        console.log(`🎯 Progressive Audio: Started playback for message ${messageId} successfully`);
      } catch (playError) {
        // Handle autoplay restriction specifically
        if (playError instanceof Error && 
            (playError.name === 'NotAllowedError' || 
             playError.message.includes('autoplay') ||
             playError.message.includes('user activation'))) {
          
          console.warn(`🎯 Progressive Audio: Autoplay blocked for message ${messageId}, showing user prompt`);
          
          // Show a subtle notification that user needs to click to hear audio
          try {
            const { Notice } = await import('obsidian');
            new Notice('🔊 Click the play button to hear the AI response', 4000);
          } catch (noticeError) {
            console.log('🔊 Progressive Audio: Click the play button to hear the AI response');
          }
          
          // Keep the audio ready to play when user manually clicks
          this.currentlyPlaying.delete(messageId);
          this.pausedAt.set(messageId, 0); // Mark as paused at beginning
          
          return;
        } else {
          // Other audio errors
          throw playError;
        }
      }
      
    } catch (error) {
      console.error(`Progressive Audio: Error starting playback for message ${messageId}:`, error);
      this.currentlyPlaying.delete(messageId);
    }
  }

  /**
   * Play the next sentence in the sequence
   */
  private playNextSentence(messageId: string): void {
    const currentIndex = this.currentlyPlaying.get(messageId);
    if (currentIndex === undefined) {
      console.warn(`Progressive Audio: No current playback found for message ${messageId}`);
      return;
    }

    const nextIndex = currentIndex + 1;
    const sequence = this.audioSequences.get(messageId);

    if (sequence && sequence[nextIndex]) {
      // Next sentence is ready, play it
      this.currentlyPlaying.set(messageId, nextIndex);
      sequence[nextIndex].play().catch(error => {
        console.error(`Progressive Audio: Error playing sentence ${nextIndex} for message ${messageId}:`, error);
        this.handlePlaybackComplete(messageId);
      });
      console.log(`Progressive Audio: Advanced to sentence ${nextIndex} for message ${messageId}`);
    } else {
      // No more sentences available, playback complete
      this.handlePlaybackComplete(messageId);
    }
  }

  /**
   * Handle completion of playback for a message
   */
  private handlePlaybackComplete(messageId: string): void {
    this.currentlyPlaying.delete(messageId);
    console.log(`Progressive Audio: Playback completed for message ${messageId}`);
    
    // 🔧 IMMEDIATE STATE NOTIFICATION: Notify UI immediately when playback completes
    this.notifyPlaybackStateChange(messageId, 'stopped');
    
    // 🔧 COMPLETION EVENT FIX: Ensure completion callback is invoked to update UI state
    if (this.onPlaybackComplete && typeof this.onPlaybackComplete === 'function') {
      console.log(`Progressive Audio: Invoking completion callback for message ${messageId}`);
      try {
        this.onPlaybackComplete(messageId);
      } catch (error) {
        console.warn(`Progressive Audio: Error in completion callback for message ${messageId}:`, error);
      }
    } else {
      console.log(`Progressive Audio: No completion callback set for message ${messageId}`);
    }
  }

  /**
   * Handle audio playback errors
   */
  private handleAudioError(messageId: string, sequenceIndex: number, event: Event): void {
    const audio = event.target as HTMLAudioElement;
    const error = audio.error;
    console.error(`Progressive Audio: Playback error for sentence ${sequenceIndex} in message ${messageId}:`, error);
    
    // Try to continue with next sentence if available
    this.playNextSentence(messageId);
  }

  /**
   * Stop playback for a specific message
   */
  stopPlayback(messageId: string): void {
    const currentIndex = this.currentlyPlaying.get(messageId);
    if (currentIndex !== undefined) {
      const sequence = this.audioSequences.get(messageId);
      if (sequence && sequence[currentIndex]) {
        try {
          sequence[currentIndex].pause();
          // Track where we paused for potential resume
          this.pausedAt.set(messageId, currentIndex);
          console.log(`Progressive Audio: Paused at sentence ${currentIndex} for message ${messageId}`);
        } catch (error) {
          console.warn(`Progressive Audio: Error stopping playback for message ${messageId}:`, error);
        }
      }
      this.currentlyPlaying.delete(messageId);
      console.log(`Progressive Audio: Stopped playback for message ${messageId}`);
      
      // 🔧 IMMEDIATE STATE NOTIFICATION: Notify UI immediately when playback stops
      this.notifyPlaybackStateChange(messageId, 'stopped');
      
      // 🔧 VOICE MODE FIX: Reset conversation manager processing state when audio is manually paused
      // This ensures the next voice interaction won't show "wait for response complete" notification
      const conversationManager = (window as unknown as { sonoriaPlugin?: { conversationManager?: { isProcessing?: boolean } } }).sonoriaPlugin?.conversationManager;
      if (conversationManager && conversationManager.isProcessing) {
        console.log(`Progressive Audio: Resetting conversation manager processing state after pause for message ${messageId}`);
        conversationManager.isProcessing = false;
      }
    }
  }

  /**
   * Check if a message is currently playing
   */
  isPlaying(messageId: string): boolean {
    return this.currentlyPlaying.has(messageId);
  }

  /**
   * Check if a message is currently paused (has audio but not playing)
   */
  isPaused(messageId: string): boolean {
    return this.pausedAt.has(messageId);
  }

  /**
   * Get the current playing sentence index for a message
   */
  getCurrentSentenceIndex(messageId: string): number | null {
    return this.currentlyPlaying.get(messageId) ?? null;
  }

  /**
   * Get the total number of sentences queued for a message
   */
  getSentenceCount(messageId: string): number {
    const sequence = this.audioSequences.get(messageId);
    return sequence ? sequence.filter(audio => audio !== undefined).length : 0;
  }

  /**
   * Clear all audio for a specific message (cleanup)
   */
  clearMessage(messageId: string): void {
    // Stop playback if active
    this.stopPlayback(messageId);

    // Clean up event listeners
    const listeners = this.eventListeners.get(messageId);
    const sequence = this.audioSequences.get(messageId);
    if (listeners && sequence) {
      sequence.forEach((audio, index) => {
        if (audio && listeners.has(index)) {
          const audioListeners = listeners.get(index);
          if (audioListeners) {
            audio.removeEventListener('ended', audioListeners.ended);
            audio.removeEventListener('error', audioListeners.error);
            audio.removeEventListener('play', audioListeners.play);
            audio.removeEventListener('pause', audioListeners.pause);
          }
        }
      });
    }

    // Clean up object URLs
    const urls = this.objectUrls.get(messageId);
    if (urls) {
      urls.forEach(url => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    }

    // Remove from all maps
    this.audioSequences.delete(messageId);
    this.objectUrls.delete(messageId);
    this.eventListeners.delete(messageId);
    this.currentlyPlaying.delete(messageId);
    this.pausedAt.delete(messageId); // Clear pause state

    console.log(`Progressive Audio: Cleared all audio for message ${messageId}`);
  }

  /**
   * Clear all messages and audio (complete cleanup)
   */
  clearAll(): void {
    const messageIds = Array.from(this.audioSequences.keys());
    messageIds.forEach(messageId => this.clearMessage(messageId));
    console.log('Progressive Audio: Cleared all audio data');
  }

  /**
   * Get playback statistics
   */
  getStats(): { 
    activePlaybacks: number; 
    totalMessages: number; 
    totalSentences: number;
    messageDetails: { messageId: string; sentenceCount: number; currentIndex: number | null }[];
  } {
    const messageDetails = Array.from(this.audioSequences.keys()).map(messageId => ({
      messageId,
      sentenceCount: this.getSentenceCount(messageId),
      currentIndex: this.getCurrentSentenceIndex(messageId)
    }));

    return {
      activePlaybacks: this.currentlyPlaying.size,
      totalMessages: this.audioSequences.size,
      totalSentences: messageDetails.reduce((sum, msg) => sum + msg.sentenceCount, 0),
      messageDetails
    };
  }

  /**
   * Check if audio is available for a specific message
   */
  hasAudioForMessage(messageId: string): boolean {
    const sequence = this.audioSequences.get(messageId);
    return Boolean(sequence && sequence.length > 0 && sequence.some(audio => audio !== undefined));
  }

  /**
   * Check if a specific message is currently playing
   */
  isPlayingMessage(messageId: string): boolean {
    return this.isPlaying(messageId);
  }

  /**
   * Start playback for a specific message (public API for play/pause buttons)
   */
  async startPlaybackForMessage(messageId: string): Promise<void> {
    const sequence = this.audioSequences.get(messageId);
    if (!sequence || sequence.length === 0) {
      throw new Error(`No audio available for message ${messageId}`);
    }

    // Check if already playing - if so, this is a redundant play call, ignore it
    if (this.currentlyPlaying.has(messageId)) {
      console.log(`Progressive Audio: Message ${messageId} already playing, ignoring duplicate play request`);
      return;
    }

    // Check if we have a paused position to resume from
    const pausedPosition = this.pausedAt.get(messageId);
    if (pausedPosition !== undefined && sequence[pausedPosition]) {
      // Resume from paused position
      console.log(`Progressive Audio: Resuming message ${messageId} from sentence ${pausedPosition}`);
      this.currentlyPlaying.set(messageId, pausedPosition);
      this.pausedAt.delete(messageId); // Clear pause state
      
      // 🔧 VOICE MODE FIX: Ensure proper state sync when resuming from pause
      try {
        await sequence[pausedPosition].play();
        console.log(`Progressive Audio: Successfully resumed playback for message ${messageId} from sentence ${pausedPosition}`);
      } catch (resumeError) {
        console.error(`Progressive Audio: Error resuming playback for message ${messageId}:`, resumeError);
        // Clean up state if resume fails
        this.currentlyPlaying.delete(messageId);
        this.pausedAt.set(messageId, pausedPosition); // Restore pause state
        throw resumeError;
      }
    } else {
      // Start from the beginning
      console.log(`Progressive Audio: Starting message ${messageId} from beginning`);
      await this.startPlayback(messageId);
    }
  }

  /**
   * Stop playback for a specific message (public API for play/pause buttons)
   */
  stopPlaybackForMessage(messageId: string): void {
    this.stopPlayback(messageId);
  }

  /**
   * Optional callback for playback completion events
   * Can be set by external code to handle completion
   */
  public onPlaybackComplete?: (messageId: string) => void;
} 