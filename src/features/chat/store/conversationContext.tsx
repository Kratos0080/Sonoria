import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message } from '../../../core/types/conversation';
// import type { OpenAIClient } from '../../../core/api/openaiClient'; // No longer directly used by ConversationManager for chat
import type { AIClient } from '../../../core/api/aiClient';
import { StorageService } from '../../../core/services/storageService';
import type { NoteService } from '@app/core/services/noteService';
import { TFile, Notice } from 'obsidian';
import type { NoteContextManager } from '../../../utils/noteContextManager';
import { formatDateForNote } from '../../../utils/dateUtils';
import { nanoid } from 'nanoid';
import { makeObservable, observable, action, runInAction } from 'mobx'; // Added runInAction
import type NoteChatPlugin from '@app/main'; // Use path alias
import { PlaceholderAIClient } from '@app/core/api/PlaceholderAIClient';
import { StreamSentenceProcessor } from '@app/utils/StreamSentenceProcessor';
import { ProgressiveTTSQueue } from '@app/utils/ProgressiveTTSQueue';
import { ProgressiveAudioPlayback } from '@app/utils/ProgressiveAudioPlayback';
import { removeCitationAnnotations } from '@app/utils/textUtils';

// Declare global types for our variables - RETAINED FROM ORIGINAL
declare global {
  interface Window {
    globalOpenAIClient: Record<string, unknown> | null; // Changed from any to Record<string, unknown>
    globalApiKey: string | null;
    lastActiveNoteContent: string | null;
    lastActiveNoteId: string | null;
    sonoriaVoiceConversationMode: boolean;
  }
}

// Define the shape of the conversation context - RETAINED FROM ORIGINAL, though some methods might change slightly
export interface ConversationContextType {
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  status: string;
  startConversation: (noteId: string, noteContent: string, additionalNoteIds: string[]) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  endConversation: () => Promise<void>;
  generateNote: () => Promise<string>;
  createNoteFromContent: (title: string, content: string) => Promise<TFile>;
  subscribe: (callback: () => void) => () => void;
  // 🛑 STOP GENERATION: Methods for cancelling AI requests
  stopGeneration: () => void;
  canStopGeneration: () => boolean;
  // May need to add methods for new fields if UI directly interacts, e.g., getVectorStoreId
}

/**
 * Class that manages conversation state and methods
 */
export class ConversationManager {
  @observable conversations: Conversation[] = [];
  @observable public currentConversation: Conversation | null = null;
  @observable public hasActiveNote: boolean = false;
  @observable public messages: Message[] = [];
  @observable public isLoading: boolean = false;
  private error: string | undefined = undefined; // CHANGED: Errors might not need direct UI observation via @observable unless a getter is provided
  @observable public status: string = '';
  @observable public streamingMessage: Message | null = null; // Add streaming message state
  @observable public isStreaming: boolean = false; // Add streaming state

  private _events: { [eventName: string]: ((...args: unknown[]) => void)[] } = {};
  private storageService: StorageService;
  private noteService: NoteService;
  private currentNoteContent: string | null = null; // Changed from '' to null to match startConversation
  @observable private isProcessing: boolean = false; // 🛑 STOP GENERATION: Make observable for UI reactivity
  private noteContextManager: NoteContextManager;
  private plugin: NoteChatPlugin;
  private aiClient: AIClient | null;
  private lastSentContextKey: string | null = null; // For context optimization
  
  // Progressive TTS components
  private streamSentenceProcessor: StreamSentenceProcessor | null = null;
  private progressiveTTSQueue: ProgressiveTTSQueue | null = null;
  private progressiveAudioPlayback: ProgressiveAudioPlayback | null = null;
  private progressiveTTSInitialized: boolean = false;
  
  // 🎯 PROGRESSIVE TTS TIMING MEASUREMENT
  private progressiveTTSStartTime: number | null = null;
  private firstSentenceAudioTime: number | null = null;
  
  // 🎯 ON-DEMAND TTS FLAG: Track when Progressive TTS is being used on-demand (user-initiated)
  private isOnDemandTTSActive: boolean = false;
  private onDemandExpectedSentences: number = 0;
  private onDemandCompletedSentences: number = 0;
  private onDemandMessageId: string | null = null;
  
  // 🛑 STOP GENERATION: AbortController for cancelling ongoing requests
  private currentAbortController: AbortController | null = null;
  
  constructor(plugin: NoteChatPlugin, aiClient: AIClient | null) {
    makeObservable(this); // Correct for decorator-based observability

    this.plugin = plugin;
    this.aiClient = aiClient;
    this.noteContextManager = plugin.noteContextManager;
    this.storageService = new StorageService(this.plugin);
    this.noteService = plugin.noteService;
    
    if (this.aiClient && this.aiClient.provider !== 'placeholder') {
      console.log(`ConversationManager: Using ${this.aiClient.provider} client with model ${this.aiClient.model}`);
    } else if (this.aiClient instanceof PlaceholderAIClient) {
      console.warn(`ConversationManager: Initialized with PlaceholderAIClient. Reason: ${this.aiClient.reason}`);
    } else {
      console.warn('ConversationManager: Initialized with NO AI Client (null).');
    }
    
    // Bind methods
    this.startConversation = this.startConversation.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.endConversation = this.endConversation.bind(this);
    this.generateNote = this.generateNote.bind(this);
    this.createNoteFromContent = this.createNoteFromContent.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.getNoteService = this.getNoteService.bind(this);
    this.setAIClient = this.setAIClient.bind(this);
    this.saveCurrentConversationToNote = this.saveCurrentConversationToNote.bind(this);
    this.addTurnToConversation = this.addTurnToConversation.bind(this); // Ensure all public methods meant to be stable refs are bound
    this.addNote = this.addNote.bind(this);
    this.removeNote = this.removeNote.bind(this);
    this.updateConversationNoteIds = this.updateConversationNoteIds.bind(this);
    // ... other methods if they need binding ...
    
    console.log('ConversationManager: Initialized');
  }

  // Getter for error if UI needs it reactively
  public getError(): string | undefined {
    return this.error;
  }

  // 🛑 STOP GENERATION: Method to cancel ongoing AI request
  @action
  public stopGeneration(): void {

    
    if (this.currentAbortController) {
      console.log('ConversationManager.stopGeneration: Cancelling ongoing AI request');
      this.currentAbortController.abort();

      this.currentAbortController = null;

      this.isProcessing = false;
      this.isLoading = false;
      this.isStreaming = false;
      this.setStreamingMessage(null);
      this.setStatus('Generation stopped');
      
      // 🛑 STOP TTS: Also stop any ongoing TTS generation and playback
      this.stopProgressiveTTS();
      
      this.emit('update');
    } else {
      console.log('ConversationManager.stopGeneration: No ongoing request to cancel');
    }
  }
  
  /**
   * Stop all ongoing Progressive TTS generation and playback
   */
  private stopProgressiveTTS(): void {
    console.log('ConversationManager.stopProgressiveTTS: Stopping TTS generation and playback');
    
    // 🔧 GENTLE STOP: Only stop generation for the actively streaming message
    // Don't clear completed message data to preserve state for UI
    if (this.progressiveTTSQueue && this.streamingMessage) {
      console.log('ConversationManager.stopProgressiveTTS: Stopping TTS queue generation for streaming message');
      try {
        this.progressiveTTSQueue.clearMessage(this.streamingMessage.id);
        console.log(`ConversationManager.stopProgressiveTTS: Cleared TTS generation for streaming message ${this.streamingMessage.id}`);
      } catch (error) {
        console.warn('ConversationManager.stopProgressiveTTS: Error stopping TTS queue:', error);
      }
    }
    
    // 🔧 GENTLE STOP: Only stop playback, don't clear audio data
    // This preserves the audio for replay via TTS buttons
    if (this.progressiveAudioPlayback) {
      console.log('ConversationManager.stopProgressiveTTS: Stopping audio playback');
      try {
        // Stop playback for current streaming message (gentle stop)
        if (this.streamingMessage) {
          this.progressiveAudioPlayback.stopPlaybackForMessage(this.streamingMessage.id);
          console.log(`ConversationManager.stopProgressiveTTS: Stopped audio playback for streaming message ${this.streamingMessage.id}`);
        }
        
        // Also stop playback for the most recent message if different (gentle stop)
        const lastMessage = this.messages[this.messages.length - 1];
        if (lastMessage && lastMessage.id !== this.streamingMessage?.id) {
          this.progressiveAudioPlayback.stopPlaybackForMessage(lastMessage.id);
          console.log(`ConversationManager.stopProgressiveTTS: Stopped audio playback for last message ${lastMessage.id}`);
        }
      } catch (error) {
        console.warn('ConversationManager.stopProgressiveTTS: Error stopping audio playback:', error);
      }
    }
    
    // 🔧 AUTO-PLAY FIX: Reset TTS state flags that could affect subsequent auto-play decisions
    if (this.isOnDemandTTSActive) {
      console.log('ConversationManager.stopProgressiveTTS: Resetting on-demand TTS state flags to prevent auto-play issues');
      this.isOnDemandTTSActive = false;
      this.onDemandExpectedSentences = 0;
      this.onDemandCompletedSentences = 0;
      this.onDemandMessageId = null;
    }
    
    // 🔧 VOICE MODE FIX: Reset processing state to prevent "wait for response complete" on next interaction
    // This is critical for voice mode where users pause audio then start new interactions
    this.isProcessing = false;
    console.log('ConversationManager.stopProgressiveTTS: Reset isProcessing flag to prevent blocking next voice interaction');
    
    // Reset timing states for fresh start in subsequent conversations
    this.progressiveTTSStartTime = null;
    this.firstSentenceAudioTime = null;
    
    console.log('ConversationManager.stopProgressiveTTS: TTS stopping complete, state flags reset');
  }

  // 🛑 STOP GENERATION: Check if generation can be stopped
  public canStopGeneration(): boolean {
    return this.currentAbortController !== null && this.isProcessing;
  }

  // Helper to generate a key for context comparison
  private _generateContextKey(notes: TFile[]): string {
    if (!notes || notes.length === 0) return '';
    return notes.map(n => n.path + n.stat.mtime).sort().join('|');
  }

  /**
   * Initialize progressive TTS components lazily when needed for voice conversations
   */
  private ensureProgressiveTTSInitialized(): boolean {
    if (this.progressiveTTSInitialized) {
      return true; // Already initialized
    }

    console.log('ConversationManager.ensureProgressiveTTSInitialized: Starting lazy initialization...');
    
    // Initialize progressive audio playback manager (always available)
    if (!this.progressiveAudioPlayback) {
      this.progressiveAudioPlayback = new ProgressiveAudioPlayback();
      console.log('ConversationManager.ensureProgressiveTTSInitialized: ProgressiveAudioPlayback initialized');
    }

    // Initialize progressive TTS queue if we have a service that supports TTS
    // Use a compatible type that works with both OpenAIService and ProgressiveTTSQueue
    let ttsService: { textToSpeech: (text: string, options?: { voice?: string; format?: string }) => Promise<Blob | null> } | null = null;
    
    // Try window.sonoriaPlugin.openAIService (the standard way)
    const globalOpenAIService = (window as unknown as { sonoriaPlugin?: { openAIService?: unknown } }).sonoriaPlugin?.openAIService;
    if (globalOpenAIService && typeof (globalOpenAIService as { textToSpeech?: unknown }).textToSpeech === 'function') {
      // Type assertion to the compatible interface - OpenAIService is compatible since string includes the specific voice types
      ttsService = globalOpenAIService as { textToSpeech: (text: string, options?: { voice?: string; format?: string }) => Promise<Blob | null> };
      console.log('ConversationManager.ensureProgressiveTTSInitialized: Using window.sonoriaPlugin.openAIService for TTS');
    }
    // Try plugin.openAIService 
    else if (this.plugin.openAIService && typeof this.plugin.openAIService.textToSpeech === 'function') {
      // OpenAIService is compatible with the generic interface
      ttsService = this.plugin.openAIService as { textToSpeech: (text: string, options?: { voice?: string; format?: string }) => Promise<Blob | null> };
      console.log('ConversationManager.ensureProgressiveTTSInitialized: Using plugin.openAIService for TTS');
    }
    // Debug what's available if nothing works
    else {
      console.warn('ConversationManager.ensureProgressiveTTSInitialized: No TTS-capable service found');
      console.log('ConversationManager.ensureProgressiveTTSInitialized: Available services:');
      console.log(`  - window.sonoriaPlugin?.openAIService: ${!!globalOpenAIService} (textToSpeech: ${typeof (globalOpenAIService as { textToSpeech?: unknown })?.textToSpeech})`);
      console.log(`  - this.plugin.openAIService: ${!!this.plugin.openAIService} (textToSpeech: ${typeof this.plugin.openAIService?.textToSpeech})`);
      console.log(`  - this.plugin.aiClient: ${!!this.plugin.aiClient}`);
      console.log(`  - this.aiClient: ${!!this.aiClient}`);
      if (this.plugin) {
        console.log(`  - plugin properties:`, Object.keys(this.plugin));
      }
      return false; // Failed to initialize
    }

    if (ttsService) {
      console.log('ConversationManager.ensureProgressiveTTSInitialized: Creating ProgressiveTTSQueue with TTS service...');
      this.progressiveTTSQueue = new ProgressiveTTSQueue(ttsService);
      console.log('ConversationManager.ensureProgressiveTTSInitialized: ProgressiveTTSQueue created successfully');
      
      // Set up event listeners for Progressive TTS
      this.progressiveTTSQueue.on('sentenceGenerated', (messageId, sequenceIndex, audioBlob, isFirstSentence) => {
        console.log(`🔄 Progressive Audio: Queued sentence ${sequenceIndex} for message ${messageId}`);
        
        // 🎯 PROGRESSIVE TTS TIMING: Record first sentence audio generation time
        if (isFirstSentence && this.firstSentenceAudioTime === null) {
          this.firstSentenceAudioTime = Date.now();
          const timeToFirstAudio = this.progressiveTTSStartTime ? 
            this.firstSentenceAudioTime - this.progressiveTTSStartTime : 0;
          console.log(`🎯 Progressive TTS Timer: First sentence audio ready at ${this.firstSentenceAudioTime}ms`);
          console.log(`🏆 PROGRESSIVE TTS SUCCESS: Time-to-first-audio = ${timeToFirstAudio}ms (${timeToFirstAudio/1000}s)`);
          
          if (timeToFirstAudio <= 3000) {
            console.log(`🎉 TARGET ACHIEVED: Time-to-first-audio ≤3 seconds! (${timeToFirstAudio}ms)`);
          } else {
            console.warn(`⚠️ TARGET MISSED: Time-to-first-audio >3 seconds (${timeToFirstAudio}ms)`);
          }
        }
        
        if (this.progressiveAudioPlayback) {
          // 🎯 AUTOPLAY LOGIC FIX: Determine autoPlay based on context
          // - Voice mode (real-time): Always auto-play first sentence during streaming
          // - Dictation mode (on-demand): Auto-play ONLY the first sentence when user explicitly clicked play
          const isRealTimeVoiceMode = this.isVoiceConversationMode() && !this.isOnDemandTTSActive;
          const isUserInitiatedOnDemand = this.isOnDemandTTSActive && sequenceIndex === 0; // Only first sentence in on-demand
          const shouldAutoPlay = isRealTimeVoiceMode || isUserInitiatedOnDemand;
          
          console.log(`🔄 Progressive Audio: Queueing sentence ${sequenceIndex} for message ${messageId}`);
          console.log(`🔄 Progressive Audio: autoPlay=${shouldAutoPlay} (realTimeVoice: ${isRealTimeVoiceMode}, onDemand: ${isUserInitiatedOnDemand}, sequenceIndex: ${sequenceIndex})`);
          console.log(`🔄 Progressive Audio: State Details - isVoiceMode: ${this.isVoiceConversationMode()}, isOnDemandActive: ${this.isOnDemandTTSActive}, isFirstSentence: ${isFirstSentence}`);
          this.progressiveAudioPlayback.queueSentenceAudio(audioBlob, messageId, sequenceIndex, isFirstSentence, shouldAutoPlay);
          
          // 🎯 ON-DEMAND COMPLETION TRACKING: Check if all on-demand sentences are complete
          if (this.isOnDemandTTSActive && this.onDemandMessageId === messageId) {
            this.onDemandCompletedSentences++;
            console.log(`🎯 On-Demand Progress: ${this.onDemandCompletedSentences}/${this.onDemandExpectedSentences} sentences complete for message ${messageId}`);
            
            if (this.onDemandCompletedSentences >= this.onDemandExpectedSentences) {
              // All expected sentences are complete, clear the flag
              this.isOnDemandTTSActive = false;
              this.onDemandExpectedSentences = 0;
              this.onDemandCompletedSentences = 0;
              this.onDemandMessageId = null;
              console.log(`🎯 On-Demand TTS: All sentences complete, cleared on-demand flag for message ${messageId}`);
            }
          }
        }
      });

      this.progressiveTTSQueue.on('firstSentenceReady', (messageId, _audioBlob) => {
        console.log(`🔄 Progressive TTS: First sentence ready for message ${messageId}, starting playback`);
        // Additional handling for first sentence if needed
      });

      this.progressiveTTSQueue.on('error', (messageId, error) => {
        console.error(`Progressive TTS: Error processing sentence for message ${messageId}:`, error);
      });
    } else {
      console.warn('ConversationManager.ensureProgressiveTTSInitialized: No TTS-capable service available - ProgressiveTTSQueue will not be initialized');
      return false; // Failed to initialize
    }

    // Initialize sentence processor (always initialize this)
    if (!this.streamSentenceProcessor) {
      this.streamSentenceProcessor = new StreamSentenceProcessor((sentence, isFirst) => {
        console.log(`ConversationManager: StreamSentenceProcessor callback triggered - sentence: "${sentence}", isFirst: ${isFirst}`);
        console.log(`ConversationManager: Mode check - shouldUseProgressive: ${this.shouldUseProgressiveTTS()}, isVoiceMode: ${this.isVoiceConversationMode()}, progressiveTTSQueue exists: ${!!this.progressiveTTSQueue}, streamingMessage exists: ${!!this.streamingMessage}`);
        
        // Always extract sentences and queue for TTS when Progressive TTS is enabled
        if (this.shouldInitializeProgressiveTTS() && this.streamingMessage && this.progressiveTTSQueue) {
          if (this.shouldProcessStreamingTTS()) {
            // Voice conversation mode: Queue for immediate TTS playback during streaming
            console.log(`ConversationManager: Calling progressiveTTSQueue.queueSentence for message ${this.streamingMessage.id} (voice mode - real-time)`);
            try {
              this.progressiveTTSQueue.queueSentence(sentence, this.streamingMessage.id, isFirst);
              console.log(`ConversationManager: Successfully queued sentence for TTS: "${sentence.substring(0, 50)}..."`);
            } catch (queueError) {
              console.error(`ConversationManager: Error queuing sentence for TTS:`, queueError);
            }
          } else {
            // Text/dictation mode: Skip real-time TTS processing to save costs
            // TTS will be generated on-demand when user clicks play button
            console.log(`ConversationManager: Skipping real-time TTS for message ${this.streamingMessage.id} (text/dictation mode - on-demand only)`);
          }
        } else {
          console.log(`ConversationManager: Skipping sentence processing - conditions not met:`);
          console.log(`  - shouldInitializeProgressive: ${this.shouldInitializeProgressiveTTS()}`);
          console.log(`  - streamingMessage: ${!!this.streamingMessage}`);
          console.log(`  - progressiveTTSQueue: ${!!this.progressiveTTSQueue}`);
          if (this.streamingMessage) {
            console.log(`  - streamingMessage.id: ${this.streamingMessage.id}`);
          }
        }
      });
      console.log('ConversationManager.ensureProgressiveTTSInitialized: StreamSentenceProcessor initialized');
    }

    this.progressiveTTSInitialized = true;
    console.log('ConversationManager: Progressive TTS components initialized lazily');
    return true;
  }

  /**
   * Check if we should initialize Progressive TTS components (for all modes with audio capability)
   */
  private shouldInitializeProgressiveTTS(): boolean {
    // Initialize Progressive TTS if we have audio features available
    const globalVoiceConversationMode = (window as unknown as { sonoriaVoiceConversationMode?: boolean }).sonoriaVoiceConversationMode || false;
    const openAIAvailable = !!this.plugin.openAIService;
    
    // Enable Progressive TTS initialization if:
    // 1. Currently in voice conversation mode
    // 2. Or if we have OpenAI service available (allows on-demand use in text mode)
    // Note: Voice features are always enabled in beta for showcasing capabilities
    const enableProgressive = globalVoiceConversationMode || openAIAvailable;
    
    console.log(`Progressive TTS Init Check: globalVoice=${globalVoiceConversationMode}, openAIAvailable=${openAIAvailable}, result=${enableProgressive}`);
    
    return enableProgressive;
  }

  /**
   * Check if we should process TTS during real-time streaming (only voice conversation mode)
   */
  private shouldProcessStreamingTTS(): boolean {
    // Only process TTS during streaming in voice conversation mode for real-time audio
    // Text/dictation modes will generate TTS on-demand when play button is clicked
    const globalVoiceConversationMode = (window as unknown as { sonoriaVoiceConversationMode?: boolean }).sonoriaVoiceConversationMode || false;
    
    console.log(`Progressive TTS Streaming Check: globalVoiceConversation=${globalVoiceConversationMode}`);
    
    return globalVoiceConversationMode;
  }

  /**
   * Check if we should use Progressive TTS (now enabled for all modes for better UX)
   * @deprecated Use shouldInitializeProgressiveTTS() and shouldProcessStreamingTTS() instead
   */
  private shouldUseProgressiveTTS(): boolean {
    // Keep for backward compatibility, but prefer the new split methods
    return this.shouldInitializeProgressiveTTS();
  }

  /**
   * Check if we're currently in active voice conversation mode (for real-time streaming)
   */
  private isVoiceConversationMode(): boolean {
    // This method specifically checks for active voice conversation mode
    // Used to determine if we should process streaming chunks in real-time
    const globalVoiceConversationMode = (window as unknown as { sonoriaVoiceConversationMode?: boolean }).sonoriaVoiceConversationMode || false;
    
    console.log(`Voice Conversation Mode Check: globalVoiceConversation=${globalVoiceConversationMode}`);
    
    return globalVoiceConversationMode;
  }

  /**
   * Clean up progressive TTS components
   */
  private cleanupProgressiveTTS(): void {
    if (this.progressiveAudioPlayback) {
      this.progressiveAudioPlayback.clearAll();
    }
    
    if (this.progressiveTTSQueue) {
      this.progressiveTTSQueue.clear();
    }
    
    if (this.streamSentenceProcessor) {
      this.streamSentenceProcessor.reset();
    }
    
    console.log('ConversationManager: Progressive TTS components cleaned up');
  }

  @action
  public setAIClient(client: AIClient | null): void {
    if (client) {
      console.log(`ConversationManager: Setting AI client - Provider: ${client.provider}, Model: ${client.model}`);
      this.aiClient = client;
    } else {
      console.warn('ConversationManager: Setting AI client to null');
      this.aiClient = null;
    }
    // this.emit('aiClientChanged'); // Consider if needed
  }

  public getAIClient(): AIClient | null {
    return this.aiClient;
  }
  
  @action
  public async addTurnToConversation(_userMessage: string, aiMessage: string, newApiResponseId?: string | null, shouldUseTTS?: boolean): Promise<void> {
    if (!this.currentConversation) {
      console.error('ConversationManager: No active conversation to add a turn to.');
      // new Notice('Error: No active conversation to add turn.'); // UI concern, handle in calling code
      return;
    }

    if (newApiResponseId) {
      this.currentConversation.previous_response_id = newApiResponseId;
    }
    const now = new Date();
    // const userMsg: Message = { // REMOVE THIS BLOCK
    //   id: nanoid(),
    //   role: 'user',
    //   content: userMessage,
    //   timestamp: now.getTime(), // Keep as number for Message type consistency
    //   conversationId: this.currentConversation.id,
    // };
    const assistantMsg: Message = {
      id: nanoid(),
      role: 'assistant',
      content: aiMessage,
      timestamp: now.getTime(), // Keep as number
      conversationId: this.currentConversation.id,
    };

    // this.currentConversation.messages.push(userMsg, assistantMsg); // OLD
    this.currentConversation.messages.push(assistantMsg); // NEW - Only push AI message
    this.currentConversation.lastModified = now.toISOString(); // Update lastModified
    this.messages = [...this.currentConversation.messages]; // Trigger MobX update for messages array
    
    try {
      await this.storageService.updateConversation(this.currentConversation);
      console.log('ConversationManager: Turn added to conversation and stored.');
    } catch (error) {
      console.error('ConversationManager: Failed to save conversation turn to storage', error);
      // this.setErrorState(`Failed to save conversation turn: ${error.message}`); // If setErrorState is implemented
    }

    // Add TTS integration for voice conversation mode only
    if (shouldUseTTS) {
      await this.handleTextToSpeech(aiMessage);
    }

    this.emit('update');
  }
  
  @action
  updateSettings() {
    // (Logic remains largely the same as provided, ensuring no direct AI client re-creation here)
    try {
      console.log('ConversationManager: Updating settings (settings object on plugin has changed)');
      console.log('ConversationManager: Settings considered (AI Client managed externally).');
    } catch (error) {
      console.error('ConversationManager: Error reacting to settings update', error);
    }
  }
  
  on(eventName: string, listener: (...args: unknown[]) => void): () => void {
    if (!this._events[eventName]) {
      this._events[eventName] = [];
    }
    this._events[eventName].push(listener);
    return () => this.off(eventName, listener);
  }

  off(eventName: string, listenerToRemove: (...args: unknown[]) => void): void {
    if (!this._events[eventName]) return;
    this._events[eventName] = this._events[eventName].filter(listener => listener !== listenerToRemove);
  }

  emit(eventName: string, ...args: unknown[]): void {
    if (!this._events[eventName]) return;
    this._events[eventName].forEach(listener => {
       setTimeout(() => listener(...args), 0);
    });
  }
  
  @action
  private setCurrentConversation(conversation: Conversation | null): void {
    console.log('Setting current conversation:', conversation ? conversation.id : 'null');
    this.currentConversation = conversation;
    this.messages = conversation ? [...conversation.messages] : [];
    // Assuming currentNoteContent will be set by context prep logic if needed, or remains from last loaded conversation
    if (conversation && conversation.noteIds && conversation.noteIds.length > 0) {
        const primaryId = conversation.primaryNoteId || conversation.noteIds[0];
        // This part was complex and might need dedicated context refresh logic
        // For now, ensure it doesn't error. Actual content loading for UI display might be separate.
        const primaryFile = primaryId ? this.plugin.app.vault.getAbstractFileByPath(primaryId) : null;
        this.hasActiveNote = !!primaryFile;
        // this.currentNoteContent = ... // Let context prep handle this before sending to AI
    } else {
        this.hasActiveNote = false;
        this.currentNoteContent = null;
    }
    this.lastSentContextKey = null; // Reset context tracking when conversation changes
    this.emit('update');
  }

  @action
  async startConversation(
    primaryNoteId: string, 
    _noteContent?: string, // Unused
    additionalNoteIdsParam: string[] = []
  ): Promise<void> {
    console.time("CM_startConversation_Total");
    let cmTotalContextPrepLabel = "CM_TotalContextPrep_StartConversation";
    try {
      if (this.isLoading) {
        console.log('ConversationManager.startConversation: Already loading/starting a conversation, ignoring request');
        return;
      }
      console.log(`ConversationManager.startConversation: Initiated. PrimaryNoteID: ${primaryNoteId}, AdditionalNoteIDs: ${additionalNoteIdsParam.join(', ')}`);
      
      if (!primaryNoteId) throw new Error('Note ID is required to start a new conversation');
      
      this.isLoading = true;
      this.error = undefined;
      this.setStatus('Starting new conversation...');
      this.emit('update');
      
      console.log(`ConversationManager.startConversation: Old lastSentContextKey: ${this.lastSentContextKey}`);
      this.setCurrentConversation(null); 
      this.messages = [];
      this.currentNoteContent = null;

      const allInitialNoteIds = [primaryNoteId, ...additionalNoteIdsParam].filter(id => !!id);
      console.log(`ConversationManager.startConversation: Constructing initial note list for new conversation: ${allInitialNoteIds.join(', ')}`);

      const contextNotes: {[noteId: string]: {title: string; included: boolean}} = {};
      const activeTFiles: TFile[] = [];

      if (this.currentConversation) { // Check if currentConversation is not null
        cmTotalContextPrepLabel = `CM_TotalContextPrep_StartConversation_${this.currentConversation.id}`;
      }
      console.time(cmTotalContextPrepLabel);

      for (const noteId of allInitialNoteIds) {
        console.log(`ConversationManager.startConversation: Processing noteId: "${noteId}"`);
        const file = this.plugin.app.vault.getAbstractFileByPath(noteId);
        
        const isTFileCompatible = file && 'path' in file && typeof file.path === 'string' &&
                                  'basename' in file && typeof file.basename === 'string' &&
                                  'name' in file && typeof file.name === 'string' &&
                                  'stat' in file && file.stat && typeof (file as TFile).stat.mtime === 'number';

        console.log(`ConversationManager.startConversation: File object for "${noteId}":`, file ? (isTFileCompatible ? `TFile-like with basename: ${(file as TFile).basename}` : `Not TFile-like`) : String(file));

        if (isTFileCompatible) {
          const tFile = file as TFile; 
          activeTFiles.push(tFile);
          contextNotes[noteId] = { title: tFile.basename, included: true };
          } else {
          console.warn(`ConversationManager.startConversation: Note ID ${noteId} not found or not a TFile-compatible object.`);
          }
      }
      console.log(`ConversationManager.startConversation: Active TFiles for initial context: ${activeTFiles.map(f => f.path).join(', ')}`);

      const newConversationId = uuidv4();
      let newVectorStoreId: string | null = null;
      const newFileIdMap: Record<string, string> = {}; 

      if (this.plugin.openAIService && this.plugin.openAIService.isAssistantConfigured()) {
        console.log(`ConversationManager.startConversation: Attempting to create new vector store for conversation ${newConversationId}`);
        const createVsLabel = this.currentConversation ? `CM_OpenAIService_createVectorStore_${this.currentConversation.id}` : "CM_OpenAIService_createVectorStore";
        console.time(createVsLabel);
        newVectorStoreId = await this.plugin.openAIService.createVectorStore(`NoteChat Session ${newConversationId}`);
        console.timeEnd(createVsLabel);
        console.log(`ConversationManager.startConversation: Created Vector Store ID: ${newVectorStoreId} for conversation ${newConversationId}`);

      if (newVectorStoreId) {
          for (const tFile of activeTFiles) {
            try {
              const fileReadLabel = `CM_FileRead_${tFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
              console.time(fileReadLabel);
              const content = await this.plugin.app.vault.cachedRead(tFile);
              console.timeEnd(fileReadLabel);

              console.log(`ConversationManager.startConversation: Uploading note ${tFile.path} to Vector Store ${newVectorStoreId}`);
              const uploadLabel = `CM_OpenAIService_uploadNoteAsFile_${tFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
              console.time(uploadLabel);
              const fileId = await this.plugin.openAIService.getOrUploadFile(content, tFile.name);
              console.timeEnd(uploadLabel);
              if (fileId) {
                console.log(`ConversationManager.startConversation: Uploaded note ${tFile.path} as File ID: ${fileId}`);
                const addFileToVsLabel = `CM_OpenAIService_addFileToVectorStore_${tFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                console.time(addFileToVsLabel);
                await this.plugin.openAIService.addFileToVectorStore(newVectorStoreId, fileId);
                console.timeEnd(addFileToVsLabel);
                newFileIdMap[tFile.path] = fileId; 
              } else {
                console.error(`ConversationManager.startConversation: Failed to upload note ${tFile.path} to vector store.`);
              }
            } catch (err) {
              console.error(`ConversationManager.startConversation: Error processing file ${tFile.path} for vector store:`, err);
            }
          }
        }
      } else {
        console.warn("ConversationManager.startConversation: OpenAIService not available or not configured for vector store creation.");
      }

      const newConversation: Conversation = {
        id: newConversationId,
        noteIds: allInitialNoteIds,
        primaryNoteId: primaryNoteId,
        title: `Chat about ${allInitialNoteIds.length > 1 ? 'multiple notes' : activeTFiles[0]?.basename || 'note'}`,
        creationDate: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        messages: [...this.messages],
        isArchived: false,
        previous_response_id: null,
        vectorStoreId: newVectorStoreId,
        uploadedFileIds: newFileIdMap,
        contextNotes: contextNotes,
      };

      this.conversations.push(newConversation);
      await this.storageService.updateConversation(newConversation);
      this.setCurrentConversation(newConversation); 
      this.lastSentContextKey = this._generateContextKey(activeTFiles);
      console.log(`ConversationManager.startConversation: New lastSentContextKey: ${this.lastSentContextKey}`);
      console.timeEnd(cmTotalContextPrepLabel);
      this.isLoading = false;
      this.setStatus('Conversation started.');

    } catch (err: unknown) {
      const specificErrorMessage = err instanceof Error ? err.message : String(err);
      const errorMessage = `Failed to start conversation: ${specificErrorMessage}`;
      this.error = errorMessage;
      console.error('ConversationManager: Failed to start conversation:', err);
      this.setStatus('Error starting conversation');
      console.timeEnd(cmTotalContextPrepLabel); // End here in case of error too
      throw new Error(errorMessage);
    } finally {
      this.isProcessing = false; 
      this.emit('update');
      console.timeEnd("CM_startConversation_Total");
    }
  }

  /**
   * Start a general chat conversation without requiring notes (for dictation/voice mode)
   */
  @action
  async startGeneralChatConversation(): Promise<void> {
    console.time("CM_startGeneralChatConversation_Total");
    try {
      if (this.isLoading) {
        console.log('ConversationManager.startGeneralChatConversation: Already loading/starting a conversation, ignoring request');
        return;
      }
      console.log('ConversationManager.startGeneralChatConversation: Initiated for general chat without notes');
      
      this.isLoading = true;
      this.error = undefined;
      this.setStatus('Starting general chat conversation...');
      this.emit('update');
      
      this.setCurrentConversation(null); 
      this.messages = [];
      this.currentNoteContent = null;

      const newConversationId = uuidv4();
      let newVectorStoreId: string | null = null;

      // For general chat, we still create a vector store but don't add any files
      // This allows the conversation to work with the Responses API
      if (this.plugin.openAIService && this.plugin.openAIService.isAssistantConfigured()) {
        console.log(`ConversationManager.startGeneralChatConversation: Creating vector store for conversation ${newConversationId}`);
        newVectorStoreId = await this.plugin.openAIService.createVectorStore(`Sonoria General Chat ${newConversationId}`);
        console.log(`ConversationManager.startGeneralChatConversation: Created Vector Store ID: ${newVectorStoreId} for conversation ${newConversationId}`);
      } else {
        console.warn("ConversationManager.startGeneralChatConversation: OpenAIService not available or not configured for vector store creation.");
      }

      const newConversation: Conversation = {
        id: newConversationId,
        noteIds: [], // Empty for general chat
        primaryNoteId: undefined, // No primary note for general chat
        title: `General Chat`,
        creationDate: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        messages: [...this.messages],
        isArchived: false,
        previous_response_id: null,
        vectorStoreId: newVectorStoreId,
        uploadedFileIds: {}, // Empty for general chat
        contextNotes: {}, // Empty for general chat
      };

      this.conversations.push(newConversation);
      await this.storageService.updateConversation(newConversation);
      this.setCurrentConversation(newConversation); 
      this.lastSentContextKey = null; // No context for general chat
      console.log(`ConversationManager.startGeneralChatConversation: Created general chat conversation`);
      this.isLoading = false;
      this.setStatus('General chat conversation started.');

    } catch (err: unknown) {
      const specificErrorMessage = err instanceof Error ? err.message : String(err);
      const errorMessage = `Failed to start general chat conversation: ${specificErrorMessage}`;
      this.error = errorMessage;
      console.error('ConversationManager: Failed to start general chat conversation:', err);
      this.setStatus('Error starting conversation');
      throw new Error(errorMessage);
    } finally {
      this.isProcessing = false; 
      this.emit('update');
      console.timeEnd("CM_startGeneralChatConversation_Total");
    }
  }
  
  @action
  async sendMessage(userInput: string): Promise<void> {
    console.time("CM_sendMessage_Total");
    let cmTotalContextPrepLabel = "CM_TotalContextPrep_SendMessage";
    let currentConvo: Conversation | null = this.currentConversation; // Declare here
    try {
        if (this.isProcessing) {
            console.warn('ConversationManager.sendMessage: Already processing a message, ignoring request.');
            new Notice('Please wait for the current response to complete.');
            return; // Exits early, so CM_sendMessage_Total won't be called by finally
        }
    console.log(`ConversationManager.sendMessage: Initiated with user input: "${userInput.substring(0, 50)}..."`);
    
    // Check if we need to create a conversation BEFORE setting loading states
    if (!currentConvo) {
      console.warn("ConversationManager: No active conversation. Creating a general chat conversation for this message.");
      try {
        // Create a general chat conversation without requiring notes
        await this.startGeneralChatConversation(); 
        currentConvo = this.currentConversation;
        if (!currentConvo) throw new Error("Failed to initialize a new conversation for sending message.");
      } catch (startError) {
        console.error("ConversationManager: Error auto-starting conversation in sendMessage:", startError);
        this.setStatus('Error');
        this.error = "Failed to start a conversation to send message.";
        this.emit('update');
        console.timeEnd("CM_sendMessage_Total"); // Ensure end in this path
        return;
      }
    }
    
    // Now set processing states after conversation exists
    
    this.isProcessing = true;
    this.isLoading = true;
    this.error = undefined;
            this.setStatus(''); // Just show loading dots without text
    
    // 🛑 STOP GENERATION: Create AbortController for this request
    this.currentAbortController = new AbortController();
    
    this.emit('update');

    const userMessageObj: Message = {
      id: nanoid(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
      conversationId: currentConvo.id,
    };
    currentConvo.messages.push(userMessageObj);
    this.messages = [...currentConvo.messages]; 
    this.emit('update'); 

    // Ensure currentConvo is not null before proceeding
    if (!currentConvo) {
        // This should ideally not be reached if the above block handles it
        throw new Error("Current conversation is null after attempting to initialize for sendMessage.");
    }

    if (this.currentConversation) { // Check for null before accessing id
        cmTotalContextPrepLabel = `CM_TotalContextPrep_SendMessage_${this.currentConversation.id}`;
    }
    console.time(cmTotalContextPrepLabel);

    try {
      if (!this.plugin.openAIService) throw new Error("OpenAIService not available.");

      const currentActiveNotes = this.getActiveNotes();
      const currentContextKey = this._generateContextKey(currentActiveNotes);
      
      console.log(`ConversationManager.sendMessage: Old lastSentContextKey: ${this.lastSentContextKey}, Current contextKey: ${currentContextKey}, Current VS ID: ${currentConvo.vectorStoreId}`);

      // 🚀 PROGRESSIVE TTS EARLY INITIALIZATION: Ensure Progressive TTS is ready for voice mode
      if (this.shouldInitializeProgressiveTTS()) {
        console.log('ConversationManager.sendMessage: Ensuring Progressive TTS is initialized before streaming begins');
        const initSuccess = this.ensureProgressiveTTSInitialized();
        if (!initSuccess) {
          console.warn('ConversationManager.sendMessage: Progressive TTS initialization failed - voice mode features may not work');
        } else {
          console.log('ConversationManager.sendMessage: Progressive TTS initialization successful');
        }
      }

      let currentVectorStoreId: string | null = currentConvo.vectorStoreId ?? null;
      let responseId: string | null = null;
      let responseText: string | null = null;
      let error: string | undefined | null = null;

      if (this.plugin.openAIService && this.plugin.openAIService.isAssistantConfigured()) {
        console.log(`ConversationManager.sendMessage: (this)lastSentContextKey: ${this.lastSentContextKey}, Current contextKey: ${currentContextKey}, CurrentConvo VS ID: ${currentConvo.vectorStoreId}`);

        if (currentContextKey !== this.lastSentContextKey || !currentConvo.vectorStoreId) {
          console.log(`ConversationManager.sendMessage: Context changed or no vector store. Old VS ID: ${currentConvo.vectorStoreId}. Creating new vector store.`);
          console.time("CM_NetworkOperations_VectorStoreSetup");
          
          if (currentConvo.vectorStoreId) {
            const oldVsId = currentConvo.vectorStoreId;
            const oldFileMap = currentConvo.uploadedFileIds ? { ...currentConvo.uploadedFileIds } : {};
            console.log(`ConversationManager.sendMessage: Deleting old Vector Store ID: ${oldVsId} and its files.`);
            
            console.time("CM_DeleteOldVectorStore");
            const vsDeleted = await this.plugin.openAIService.deleteVectorStore(oldVsId);
            console.timeEnd("CM_DeleteOldVectorStore");
            
            if (vsDeleted) {
              console.time("CM_DeleteOldFiles");
              const deletePromises = Object.values(oldFileMap).map(fileId => {
                return this.plugin.openAIService?.deleteUploadedFile(fileId as string); // Ensure fileId is string
              });
              await Promise.all(deletePromises);
              console.timeEnd("CM_DeleteOldFiles");
              console.log(`ConversationManager.sendMessage: Finished deleting files for old VS ID: ${oldVsId}.`);
            } else {
              console.warn(`ConversationManager.sendMessage: Failed to delete old VS ID: ${oldVsId}. Files may remain.`);
            }
            currentConvo.uploadedFileIds = {}; 
          }

          const createVsLabel = currentConvo ? `CM_OpenAIService_createVectorStore_${currentConvo.id}` : "CM_OpenAIService_createVectorStore";
          console.time(createVsLabel);
          currentVectorStoreId = await this.plugin.openAIService.createVectorStore(`NoteChat Session ${currentConvo.id} - Context Update`);
          console.timeEnd(createVsLabel);

          console.log(`ConversationManager.sendMessage: Created new Vector Store ID: ${currentVectorStoreId}`);
          currentConvo.vectorStoreId = currentVectorStoreId;
          if (!currentConvo.uploadedFileIds) {
            currentConvo.uploadedFileIds = {};
          }

          if (currentVectorStoreId) {
            console.time("CM_FileUploadAndIndexing_Loop");
            const fileProcessingPromises: Promise<void>[] = [];
            
            for (const tFile of currentActiveNotes) {
              const filePromise = (async () => {
                try {
                  const fileReadSendMessageLabel = `CM_FileRead_${tFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                  console.time(fileReadSendMessageLabel);
                  const content = await this.plugin.app.vault.cachedRead(tFile);
                  console.timeEnd(fileReadSendMessageLabel);

                  console.log(`ConversationManager.sendMessage: Uploading note ${tFile.path} to new Vector Store ${currentVectorStoreId}`);
                  const uploadSendMessageLabel = `CM_OpenAIService_uploadNoteAsFile_${tFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                  console.time(uploadSendMessageLabel);
                  const fileId = await this.plugin.openAIService.getOrUploadFile(content, tFile.name);
                  console.timeEnd(uploadSendMessageLabel);
                  if (fileId) {
                    console.log(`ConversationManager.sendMessage: Uploaded note ${tFile.path} as File ID: ${fileId}. Attempting to add to VS ${currentVectorStoreId}.`);
                    const addFileToVsSendMessageLabel = `CM_OpenAIService_addFileToVectorStore_${tFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                    console.time(addFileToVsSendMessageLabel);
                    const addedAndIndexed = await this.plugin.openAIService.addFileToVectorStore(currentVectorStoreId, fileId);
                    console.timeEnd(addFileToVsSendMessageLabel);
                    if (addedAndIndexed) {
                      console.log(`ConversationManager.sendMessage: Successfully added and indexed File ID ${fileId} (${tFile.name}) to VS ${currentVectorStoreId}.`);
                      if (!currentConvo.uploadedFileIds) {
                        currentConvo.uploadedFileIds = {};
                      }
                      currentConvo.uploadedFileIds[tFile.path] = fileId; 
                    } else {
                      console.warn(`ConversationManager.sendMessage: File ID ${fileId} (${tFile.name}) was NOT successfully indexed in VS ${currentVectorStoreId}. File Search may not work for this file.`);
                      if (!currentConvo.uploadedFileIds) {
                        currentConvo.uploadedFileIds = {};
                      }
                      currentConvo.uploadedFileIds[tFile.path] = fileId; 
                    }
                  } else {
                     console.error(`ConversationManager.sendMessage: Failed to upload note ${tFile.path} to new vector store. Cannot add to VS.`);
                  }
                } catch (err) {
                  console.error(`ConversationManager.sendMessage: Error processing file ${tFile.path} for new vector store:`, err);
                }
              })();
              
              fileProcessingPromises.push(filePromise);
            }
            
            // Wait for all file operations to complete
            await Promise.all(fileProcessingPromises);
            console.timeEnd("CM_FileUploadAndIndexing_Loop");
          }
          
          console.timeEnd("CM_NetworkOperations_VectorStoreSetup");
          this.lastSentContextKey = currentContextKey;
          await this.storageService.updateConversation(currentConvo); 
          console.log(`ConversationManager.sendMessage: Updated lastSentContextKey: ${this.lastSentContextKey} and saved conversation.`);
        } else {
          console.log(`ConversationManager.sendMessage: Context unchanged. Using existing Vector Store ID: ${currentConvo.vectorStoreId}`);
          currentVectorStoreId = currentConvo.vectorStoreId;
        }
      } else {
        console.warn("ConversationManager.sendMessage: OpenAIService not available or not configured for vector store operations.");
      }
      
      console.timeEnd(cmTotalContextPrepLabel);
      this.setStatus('Waiting for AI response...');
      
      // Keep loading state (shows 4 dots) until first content arrives

      
      const getResponseLabel = "OpenAIService_getAssistantResponse_FullCall";
      let timerStarted = false;
      const openAIServiceExists = !!this.plugin.openAIService;
      const isConfigured = openAIServiceExists && this.plugin.openAIService.isAssistantConfigured();
      console.log(`ConversationManager.sendMessage: Pre-API call. userInput: "${userInput}", prevRespId: ${currentConvo.previous_response_id}, vsId: ${currentVectorStoreId}, openAIServiceExists: ${openAIServiceExists}, isConfigured: ${isConfigured}`);

      if (this.plugin.openAIService && isConfigured) {
          console.time(getResponseLabel);
          timerStarted = true;
          // Define streaming callback with progressive TTS integration
          const onChunk = (textChunk: string, isFinalChunk: boolean, _responseId?: string | null, error?: string | null) => {
            if (error) {
              console.error('ConversationManager.sendMessage: Streaming error:', error);
              runInAction(() => {
                this.setStreamingMessage(null);
              });
              return;
            }
            
            // Create streaming message bubble only when first content arrives
            if (textChunk && !this.streamingMessage && currentConvo) {

              const streamingMessageId = nanoid();
              const initialStreamingMessage: Message = {
                id: streamingMessageId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                conversationId: currentConvo.id,
              };
              this.setStreamingMessage(initialStreamingMessage);
              
            }
            
            if (textChunk && this.streamingMessage) {
              // 🎯 PROGRESSIVE TTS TIMING: Start timer on first text chunk in voice mode
              if (this.isVoiceConversationMode() && this.progressiveTTSStartTime === null) {
                this.progressiveTTSStartTime = Date.now();
                console.log(`🔊 Progressive TTS Timer: AI streaming started at ${this.progressiveTTSStartTime}ms`);
              }
              
              // Update streaming message content using proper MobX action
              runInAction(() => {
                if (this.streamingMessage) {
                  const currentContent = this.streamingMessage.content || '';
                  this.streamingMessage.content = currentContent + textChunk;
                  this.emit('update');
                }
              });

              // PROGRESSIVE TTS INTEGRATION: Process text chunk for sentence extraction
              console.log(`Progressive TTS Debug: streamSentenceProcessor exists: ${!!this.streamSentenceProcessor}, shouldInitialize: ${this.shouldInitializeProgressiveTTS()}, shouldProcessStreaming: ${this.shouldProcessStreamingTTS()}`);
              console.log(`Progressive TTS Debug: globalVoiceMode: ${(window as unknown as { sonoriaVoiceConversationMode?: boolean }).sonoriaVoiceConversationMode}, streamingMessage: ${!!this.streamingMessage}, progressiveTTSQueue: ${!!this.progressiveTTSQueue}`);
              if (this.shouldInitializeProgressiveTTS()) {
                // Ensure Progressive TTS is initialized for any mode that wants it
                if (this.ensureProgressiveTTSInitialized() && this.streamSentenceProcessor) {
                  if (this.shouldProcessStreamingTTS()) {
                    // Voice mode: Process text chunks in real-time for immediate audio generation
                    console.log(`Progressive TTS: Processing text chunk for real-time sentence extraction (voice mode) - chunk: "${textChunk}"`);
                    try {
                      this.streamSentenceProcessor.processTextChunk(textChunk);
                      console.log(`Progressive TTS: Successfully processed text chunk in voice mode`);
                    } catch (processingError) {
                      console.warn('Progressive TTS: Error processing text chunk in voice mode:', processingError);
                    }
                  } else {
                    // Text/dictation mode: Skip real-time processing, TTS will be on-demand
                    console.log('Progressive TTS: Skipping real-time processing (text/dictation mode - cost optimization)');
                  }
                } else {
                  console.error('Progressive TTS: Initialization failed or no sentence processor available');
                  console.log(`Progressive TTS Debug: ensureInitialized result: ${this.ensureProgressiveTTSInitialized()}, streamSentenceProcessor: ${!!this.streamSentenceProcessor}, progressiveTTSQueue: ${!!this.progressiveTTSQueue}`);
                }
              } else {
                console.log('Progressive TTS: Skipping processing - not enabled for current mode');
              }
            }
            
            if (isFinalChunk) {
              console.log('ConversationManager.sendMessage: Streaming completed');
              
              // PROGRESSIVE TTS INTEGRATION: Finalize any remaining text as the last sentence
              if (this.shouldInitializeProgressiveTTS()) {
                // Ensure Progressive TTS is initialized for any mode that wants it
                if (this.ensureProgressiveTTSInitialized() && this.streamSentenceProcessor) {
                  if (this.shouldProcessStreamingTTS()) {
                    // Voice mode: Finalize sentence processing for real-time TTS
                    console.log('Progressive TTS: Finalizing sentence processing (voice mode)');
                    try {
                      this.streamSentenceProcessor.finalize();
                      // Reset processor for next stream
                      this.streamSentenceProcessor.reset();
                      
                      // 🎯 PROGRESSIVE TTS TIMING: Reset timing variables for next interaction (only in voice mode)
                      setTimeout(() => {
                        console.log('🔄 Progressive TTS: Resetting timing measurements for next interaction');
                        this.progressiveTTSStartTime = null;
                        this.firstSentenceAudioTime = null;
                      }, 1000); // Reset after 1 second to allow final measurements to complete
                      
                    } catch (processingError) {
                      console.warn('Progressive TTS: Error finalizing sentence processing in voice mode:', processingError);
                    }
                  } else {
                    // Text/dictation mode: Just reset the processor, no TTS processing needed
                    console.log('Progressive TTS: Resetting processor without processing (text/dictation mode)');
                    this.streamSentenceProcessor.reset();
                  }
                } else {
                  console.log('Progressive TTS: Finalization skipped - initialization failed or no sentence processor');
                }
              }
              
              // Streaming is complete - the message will be finalized after API call completes
            }
          };

          const apiResponse = await this.plugin.openAIService.getAssistantResponse(
            userInput,
            currentVectorStoreId,
            onChunk,
            this.currentAbortController?.signal
          );
          responseId = apiResponse.responseId;
          responseText = apiResponse.responseText;
          error = apiResponse.error;
        
      } else {
        throw new Error("OpenAIService not available or not configured for API call.");
      }
      
      // 🔧 TIMER FIX: Only end timer if it was started
      if (timerStarted) {
        console.timeEnd(getResponseLabel);
      }

      if (error || !responseText) {
        // Clear streaming message on error
        this.setStreamingMessage(null);
        // 🔧 MOBX FIX: Wrap state modification in runInAction
        runInAction(() => {
          this.isLoading = false; // Also set loading false on error
        });
        
        throw new Error(error || "AI response was empty or failed.");
      }

      if (responseText && !error) {
        // Finalize streaming message
        if (this.streamingMessage && this.currentConversation) {
          // Create a NEW message object instead of reusing the streaming message reference
          // This prevents duplicate rendering issues caused by shared object references
          const completedMessage: Message = {
            id: this.streamingMessage.id, // Keep the same ID for consistency
            role: this.streamingMessage.role,
            content: this.streamingMessage.content,
            timestamp: this.streamingMessage.timestamp,
            conversationId: this.streamingMessage.conversationId,
          };
          
          // Clear streaming state FIRST to prevent duplicate rendering
          this.setStreamingMessage(null);
          
          // 🔧 MOBX FIX: Wrap state modifications in runInAction
          runInAction(() => {
            // 🛑 FIX: Now that streaming is complete, set isLoading = false
            this.isLoading = false;
            
            // Then add the NEW completed message to the conversation
            if (this.currentConversation) {
              this.currentConversation.messages.push(completedMessage);
              this.messages = [...this.currentConversation.messages];
            }
          });
          this.emit('update');
        }
        
        // Update conversation with response ID
        if (responseId) {
          currentConvo.previous_response_id = responseId;
        }
        currentConvo.lastModified = new Date().toISOString();
        await this.storageService.updateConversation(currentConvo);
        
        // TTS is now handled in addTurnToConversation for voice modes only
        // await this.handleTextToSpeech(responseText); // Removed - TTS only for voice conversation mode
        
        this.setStatus('Ready');
      } else {
        this.setStreamingMessage(null);
        // 🔧 MOBX FIX: Wrap state modification in runInAction
        runInAction(() => {
          this.isLoading = false; // Also set loading false on error
        });
        
        throw new Error(error || "AI response was empty or failed.");
      }
      console.log('ConversationManager: Message exchange completed successfully using Assistants API.');

    } catch (error: unknown) { // This catch is for the inner try block starting at line 430
      console.error('ConversationManager: Error during context preparation or AI call within sendMessage:', error);
      // Ensure currentConvo is checked before use, although it should be defined if this block is reached after context prep.
      if (currentConvo) { 
        const errorMessage = error instanceof Error ? error.message : String(error);
        currentConvo.error = errorMessage || "Error during message processing.";
        // Note: Don't add system error message here as this will be re-thrown to outer catch
        // which will handle the user-visible error message to prevent duplicates
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error = errorMessage || "Failed to get AI response.";
      this.setStatus('Error');
      // Note: cmTotalContextPrepLabel might not have been ended if error was before its end.
      // Consider if it needs to be ended here or if the outer catch handles it.
      // For now, the outer catch will handle it.
      throw error; // Re-throw to be caught by the outer try-catch which handles CM_sendMessage_Total
    } 
    // No finally for the inner try, the outer finally will handle CM_sendMessage_Total

    // This is the end of the main logic for the outer try block of sendMessage
    } catch (error: unknown) { // This is the outer catch for sendMessage (previously around line 555)
      console.error('ConversationManager: Error sending message via OpenAIService:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error = errorMessage || "Failed to get AI response.";
      if (currentConvo) { 
        currentConvo.error = this.error;
        const isUserCancellation = this.error.includes("cancelled by user") || this.error.includes("cancelled before starting");
        const systemErrorMessage: Message = {
            id: nanoid(),
            role: 'system',
            content: isUserCancellation ? this.error : `Error: ${this.error}`,
            timestamp: Date.now(),
            conversationId: currentConvo.id,
        };
        currentConvo.messages.push(systemErrorMessage);
        this.messages = [...currentConvo.messages];
        this.storageService.updateConversation(currentConvo).catch(e => console.error("Failed to save system error message", e));
      }
      this.setStatus('Error');
      console.timeEnd(cmTotalContextPrepLabel); // End context prep timer on error in outer catch
    } finally {
      // 🛑 STOP GENERATION: Only clean up if not already handled by stopGeneration
      if (this.currentAbortController && !this.currentAbortController.signal.aborted) {
        // Normal completion - clean up everything

        this.currentAbortController = null;
        // 🔧 MOBX FIX: Wrap state modifications in runInAction
        runInAction(() => {
          // 🛑 FIX: Don't set isLoading = false here, let streaming completion handle it
          // this.isLoading = false; // Moved to when streaming actually completes
          this.isProcessing = false;
        });
      } else if (this.currentAbortController && this.currentAbortController.signal.aborted) {
        // Was aborted - stopGeneration already handled cleanup
        
      } else {
        // No abort controller - probably an error case
        runInAction(() => {
          this.isLoading = false;
          this.isProcessing = false;
        });
      }
      
      this.emit('update');
      console.timeEnd("CM_sendMessage_Total");
    }
  }
  
  // Method to get active notes. Ensure currentConversation is checked.
  private getActiveNotes(): TFile[] {
    if (this.currentConversation && this.currentConversation.noteIds) {
      return this.currentConversation.noteIds
        .map(noteId => this.plugin.app.vault.getAbstractFileByPath(noteId))
        .filter((file): file is TFile => file instanceof TFile && !!file) as TFile[]; // Added instanceof TFile for stricter checking
    }
    return [];
  }
  
  @action
  async endConversation(): Promise<void> {
    console.log('ConversationManager.endConversation: Initiated.');
    if (this.isLoading) {
        console.warn('ConversationManager.endConversation: Currently loading, cannot end conversation yet.');
        return;
    }
    if (!this.currentConversation) {
      console.log('ConversationManager.endConversation: No active conversation to end.');
      return;
    }
    
    this.isLoading = true;
    this.status = 'Ending conversation...';
    this.emit('update');

    const conversationToEnd = { ...this.currentConversation };

    try {
        if (conversationToEnd.vectorStoreId && this.plugin.openAIService) {
            console.log(`ConversationManager.endConversation: Attempting to delete Vector Store ID: ${conversationToEnd.vectorStoreId}`);
            const vsDeleted = await this.plugin.openAIService.deleteVectorStore(conversationToEnd.vectorStoreId);
            if (vsDeleted) {
                console.log(`ConversationManager.endConversation: Successfully deleted Vector Store ID: ${conversationToEnd.vectorStoreId}`);
                // Now, delete all associated uploaded files
                if (conversationToEnd.uploadedFileIds) {
                    console.log(`ConversationManager.endConversation: Deleting associated uploaded files for VS ${conversationToEnd.vectorStoreId}`);
                    for (const fileId of Object.values(conversationToEnd.uploadedFileIds)) {
                        if (fileId) {
                            console.log(`ConversationManager.endConversation: Attempting to delete uploaded File ID: ${fileId}`);
                            const fileDeleted = await this.plugin.openAIService.deleteUploadedFile(fileId as string);
                            if (fileDeleted) {
                                console.log(`ConversationManager.endConversation: Successfully deleted uploaded File ID: ${fileId}`);
                            } else {
                                console.warn(`ConversationManager.endConversation: Failed to delete uploaded File ID: ${fileId}`);
                            }
                        }
                    }
                    console.log(`ConversationManager.endConversation: Finished attempting to delete associated uploaded files for VS ${conversationToEnd.vectorStoreId}`);
                }
            } else {
                console.warn(`ConversationManager.endConversation: Failed to delete Vector Store ID: ${conversationToEnd.vectorStoreId}`);
            }
        } else if (this.plugin.openAIService) {
            // If there was no vector store, but there might be orphaned files (e.g. from a failed prior VS creation)
            // This logic is a bit more speculative, but aims for cleanup.
            if (conversationToEnd.uploadedFileIds) {
                console.log(`ConversationManager.endConversation: No Vector Store ID for conversation ${conversationToEnd.id}, but found uploadedFileIds. Attempting to delete orphaned files.`);
                for (const fileId of Object.values(conversationToEnd.uploadedFileIds)) {
                    if (fileId) {
                        console.log(`ConversationManager.endConversation: Attempting to delete (potentially orphaned) uploaded File ID: ${fileId}`);
                        await this.plugin.openAIService.deleteUploadedFile(fileId as string);
                         // Log success/failure as above if needed, or keep it simpler for orphans
                    }
                }
            }
        }

        await this.storageService.deleteConversation(conversationToEnd.id);
        console.log(`ConversationManager.endConversation: Conversation ${conversationToEnd.id} deleted from storage.`);

    } catch (error: unknown) {
        console.error('ConversationManager.endConversation: Error during cleanup or storage deletion:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.error = `Failed to end conversation: ${errorMessage}`;
        this.status = 'Error ending conversation';
    } finally {
        this.setCurrentConversation(null);
        this.messages = [];
        this.isLoading = false;
        this.status = 'Conversation ended';
            this.lastSentContextKey = null;
    
    // Clean up progressive TTS components
    this.cleanupProgressiveTTS();
    
    this.emit('update');
    console.log('ConversationManager.endConversation: Completed.');
  }
  }
  
  @action
  async generateNote(): Promise<string> {
    // console.log('ConversationManager: generateNote called, currentConversation:', 
    //   this.currentConversation ? this.currentConversation.id : 'null');
    
    let conversationToProcess = this.currentConversation;

    if (!conversationToProcess) {
      if (this.messages.length > 0) { // Allow generating note from messages even if currentConversation is null
        // console.log('ConversationManager: No active conversation, creating temporary one for note generation from current messages.');
        const tempId = 'temp-note-gen-' + uuidv4();
        const tempTitle = `Generated Note from Session ${new Date().toLocaleString()}`;
        const isoNow = new Date().toISOString();
        
        conversationToProcess = {
            id: tempId,
          noteIds: this.getActiveNotes().map(f => f.path), // Try to get active notes if any
            title: tempTitle,
          creationDate: isoNow,
          lastModified: isoNow,
          messages: [...this.messages], // Use current messages
          isArchived: false, // Not archived
          previous_response_id: null, // No response chain for this temp object
          vectorStoreId: null, // No vector store for this temp object
          activeNoteIds: this.getActiveNotes().map(f => f.path), // from type
          error: undefined, // from type
        };
        // console.log('ConversationManager: Created temporary conversation for note generation:', conversationToProcess.id);
      } else {
        this.error = 'No messages in current session to generate a note from.';
        this.setStatus('No content for note');
        this.emit('update');
        throw new Error('No messages to generate a note from.');
      }
    }

    try {
      if (!this.aiClient || this.aiClient.provider === 'placeholder') {
        throw new Error('AI client is not configured for note generation.');
      }
      
      this.isLoading = true;
      this.error = undefined; // Ensure this is undefined
      this.setStatus('Generating note...');
      this.emit('update');

      // console.log(`ConversationManager: Generating structured note from ${conversationToProcess.messages.length} messages.`);
      
      let noteContextForGeneration = this.currentNoteContent || "";
      if (!noteContextForGeneration && conversationToProcess.noteIds && conversationToProcess.noteIds.length > 0) {
          const { primaryNoteContent: contextPrimary, additionalContext: contextAdditional } = 
            await this.noteContextManager.getMultiNoteContext(
              conversationToProcess.primaryNoteId || conversationToProcess.noteIds[0], 
              conversationToProcess.noteIds.slice(1)
            );
          noteContextForGeneration = `${contextPrimary || ''}\n${contextAdditional || ''}`.trim();
      }

      const structuredNote = await this.aiClient.generateStructuredNote(
        conversationToProcess.messages,
        noteContextForGeneration
      );
      
      // console.log('ConversationManager: Structured note generated successfully');
      this.setStatus('Note generated');
      return structuredNote;
    } catch (err: unknown) {
      const specificErrorMessage = err instanceof Error ? err.message : String(err);
      this.error = `Failed to generate note: ${specificErrorMessage}`;
      console.error('Failed to generate note:', err);
      this.setStatus('Error generating note');
      throw err;
    } finally {
      this.isLoading = false;
      this.isProcessing = false; // Restore this line
      this.emit('update');
    }
  }

  // saveCurrentConversationToNote, createNoteFromRawContent, createNoteFromContent
  // getNoteService, setStatus
  // updateConversationNoteIds, addNote, removeNote - all need to use lastModified
  // formatConversationForSaving - needs to use creationDate, lastModified

  // The following methods are from the truncated part, I'll reconstruct and update them.
  
  @action
  public updateConversationNoteIds(noteIds: string[]): void {
    if (!this.currentConversation) {
      console.warn('ConversationManager: No active conversation to update note IDs for.');
      return;
    }
    console.log(`ConversationManager: Updating note IDs for conversation ${this.currentConversation.id} with:`, noteIds);
    this.currentConversation.noteIds = [...noteIds];
    if (noteIds.length > 0 && !noteIds.includes(this.currentConversation.primaryNoteId || '')) {
        this.currentConversation.primaryNoteId = noteIds[0];
    } else if (noteIds.length === 0) {
        this.currentConversation.primaryNoteId = undefined;
    }
    this.currentConversation.lastModified = new Date().toISOString();
    this.lastSentContextKey = null; // Force context resync for File Search
    this.setCurrentConversation(this.currentConversation); // To trigger reactions if any part of currentConversation object needs to be new for MobX
    this.storageService.updateConversation(this.currentConversation).catch(error => {
        console.error('ConversationManager: Failed to update note IDs in storage:', error);
      });
    this.emit('update'); // Ensure UI for selected notes list updates
  }

  public getMessages(): Message[] {
    return this.messages;
  }

  public getIsLoading(): boolean {
    return this.isLoading;
  }

  public getStatus(): string {
    return this.status;
  }

  @action
  public async addNote(noteId: string, autoStartConversation: boolean = true): Promise<void> {
    const addNoteTotalLabel = `CM_addNote_Total_${noteId.replace(/[^a-zA-Z0-9]/g, "_")}`;
    console.time(addNoteTotalLabel);
    let newNoteFile: TFile | null = null;
    let contextPrepLabel: string | null = null;
    let timerEnded = false; // Track if timer has been ended

    try {
        // If no active conversation, automatically start a new one with this note (if enabled)
        if (!this.currentConversation) {
            if (!autoStartConversation) {
                console.log('ConversationManager.addNote: No active conversation and auto-start disabled. Skipping.');
                console.timeEnd(addNoteTotalLabel);
                timerEnded = true;
                return;
            }
            
            console.log('ConversationManager.addNote: No active conversation. Starting new conversation with this note.');
            
            // Get the file to use as primary note
            const abstractFile = this.plugin.app.vault.getAbstractFileByPath(noteId);
            if (!(abstractFile instanceof TFile)) {
                new Notice(`Cannot add note: File not found or not a valid note: ${noteId}`);
                console.error(`ConversationManager.addNote: Could not find TFile for noteId: ${noteId}`);
                console.timeEnd(addNoteTotalLabel);
                timerEnded = true;
                return;
            }
            
            // Start a new conversation with this note as primary
            try {
                console.log(`ConversationManager.addNote: About to start conversation with noteId: ${noteId}`);
                await this.startConversation(noteId, undefined, []);
                console.log(`ConversationManager.addNote: Successfully started conversation. Current conversation:`, (this.currentConversation as Conversation | null)?.id || 'null');
                console.log(`ConversationManager.addNote: Conversation noteIds:`, (this.currentConversation as Conversation | null)?.noteIds || []);
                
                // startConversation already adds the note, so we're done
                new Notice(`Started new conversation with note: ${abstractFile.basename}`);
                console.timeEnd(addNoteTotalLabel);
                timerEnded = true;
                return;
            } catch (startConversationError) {
                console.error(`ConversationManager.addNote: Failed to start conversation:`, startConversationError);
                new Notice(`Failed to start conversation with note: ${abstractFile.basename}. Error: ${startConversationError instanceof Error ? startConversationError.message : String(startConversationError)}`);
                console.timeEnd(addNoteTotalLabel);
                timerEnded = true;
                return;
            }
        }

        if (!this.plugin.openAIService || !this.plugin.openAIService.isAssistantConfigured()) {
          console.warn('ConversationManager.addNote: OpenAIService not available or not configured.');
          new Notice('Cannot add note: AI Service not configured. Please check API key.');
          console.timeEnd(addNoteTotalLabel);
          timerEnded = true;
          return;
        }
        
        const abstractFile = this.plugin.app.vault.getAbstractFileByPath(noteId);
        if (!(abstractFile instanceof TFile)) {
            new Notice(`Cannot add note: File not found or not a valid note: ${noteId}`);
            console.error(`ConversationManager.addNote: Could not find TFile for noteId: ${noteId}`);
            console.timeEnd(addNoteTotalLabel);
            timerEnded = true;
            return;
        }
        newNoteFile = abstractFile;

        console.log(`ConversationManager.addNote: Initiated for Note ID: ${noteId}. Current VS ID: ${this.currentConversation.vectorStoreId}`);
        this.isLoading = true;
        this.error = undefined;
        this.setStatus(`Adding note: ${newNoteFile.basename}...`);
        this.emit('update');

        if (this.currentConversation.noteIds.includes(noteId)) {
          console.log(`ConversationManager.addNote: Note ID ${noteId} already in conversation.`);
          this.isLoading = false;
          this.setStatus(`Note ${newNoteFile.basename} already in conversation.`);
          this.emit('update');
          new Notice(`Note ${newNoteFile.basename} is already in context.`);
          console.timeEnd(addNoteTotalLabel);
          timerEnded = true;
          return;
        }

        console.log(`ConversationManager.addNote: Old lastSentContextKey: ${this.lastSentContextKey}`);
        
        contextPrepLabel = `CM_TotalContextPrep_AddNote_${newNoteFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
        console.time(contextPrepLabel);

        let fileAddedToVS = false;
        if (!this.currentConversation.vectorStoreId && this.plugin.openAIService) {
            console.log("ConversationManager.addNote: No existing Vector Store. Attempting to create one.");
            const createVsLabel = this.currentConversation ? `CM_OpenAIService_createVectorStore_AddNote_${this.currentConversation.id}` : "CM_OpenAIService_createVectorStore_AddNote";
            console.time(createVsLabel);
            const newVsId = await this.plugin.openAIService.createVectorStore(`NoteChat Session AddNote - ${this.currentConversation.id.substring(0,8)}`);
            console.timeEnd(createVsLabel);
            if (newVsId) {
                this.currentConversation.vectorStoreId = newVsId;
                console.log(`ConversationManager.addNote: Created new Vector Store ${newVsId}`);
            } else {
                console.error("ConversationManager.addNote: Failed to create new Vector Store.");
                this.error = 'Failed to create Vector Store for adding note.';
                this.setStatus('Error');
                if (contextPrepLabel) console.timeEnd(contextPrepLabel);
                console.timeEnd(addNoteTotalLabel);
                timerEnded = true;
                return; // Critical failure
            }
        }
        
        if (this.currentConversation.vectorStoreId && this.plugin.openAIService) {
            try {
              const fileContent = await this.plugin.noteService.getFileContent(newNoteFile);
              if (fileContent === null) {
                console.warn(`ConversationManager.addNote: File content is null for ${newNoteFile.name}. Skipping VS operations.`);
                new Notice(`Content for ${newNoteFile.basename} is empty. Added to list, but not to AI context.`);
              } else {
                const uploadAddNoteLabel = `CM_OpenAIService_uploadNoteAsFile_${newNoteFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                console.time(uploadAddNoteLabel);
                let uploadedFileId = await this.plugin.openAIService.getOrUploadFile(fileContent, newNoteFile.name);
                console.timeEnd(uploadAddNoteLabel);

                if (uploadedFileId && this.currentConversation.vectorStoreId) { // Double check VS ID again
                  console.log(`ConversationManager.addNote: Uploaded added note ${newNoteFile.name} as File ID: ${uploadedFileId}. Adding to VS.`);
                  const addFileToVsAddNoteLabel = `CM_OpenAIService_addFileToVectorStore_${newNoteFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                  console.time(addFileToVsAddNoteLabel);
                  let added = await this.plugin.openAIService.addFileToVectorStore(
                    this.currentConversation.vectorStoreId,
                    uploadedFileId
                  );
                  console.timeEnd(addFileToVsAddNoteLabel);
                  
                  // 🔧 RETRY LOGIC: If adding to vector store failed, try re-uploading and adding again
                  if (!added) {
                    console.warn(`ConversationManager.addNote: First attempt to add file ${uploadedFileId} to VS failed. Retrying with fresh upload...`);
                    
                    // Clear cache and re-upload the file
                    this.plugin.openAIService.clearFileCache();
                    const retryUploadLabel = `CM_OpenAIService_retryUpload_${newNoteFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                    console.time(retryUploadLabel);
                    const retryUploadedFileId = await this.plugin.openAIService.getOrUploadFile(fileContent, newNoteFile.name);
                    console.timeEnd(retryUploadLabel);
                    
                    if (retryUploadedFileId && this.currentConversation.vectorStoreId) {
                      console.log(`ConversationManager.addNote: Retry upload successful. New File ID: ${retryUploadedFileId}. Adding to VS.`);
                      const retryAddLabel = `CM_OpenAIService_retryAddToVS_${newNoteFile.basename.replace(/[^a-zA-Z0-9]/g, "_")}`;
                      console.time(retryAddLabel);
                      added = await this.plugin.openAIService.addFileToVectorStore(
                        this.currentConversation.vectorStoreId,
                        retryUploadedFileId
                      );
                      console.timeEnd(retryAddLabel);
                      
                      if (added) {
                        // Use the new file ID for the conversation
                        uploadedFileId = retryUploadedFileId;
                        console.log(`ConversationManager.addNote: Retry successful. Using new File ID: ${retryUploadedFileId}`);
                      }
                    }
                  }
                  
                  if (added) {
                    this.currentConversation.uploadedFileIds = this.currentConversation.uploadedFileIds || {};
                    this.currentConversation.uploadedFileIds[noteId] = uploadedFileId;
                    fileAddedToVS = true;
                    console.log(`ConversationManager.addNote: Note ${newNoteFile.name} (File ID: ${uploadedFileId}) added to Vector Store ${this.currentConversation.vectorStoreId}.`);
                  } else {
                    console.error(`ConversationManager.addNote: Failed to add File ID ${uploadedFileId} to Vector Store ${this.currentConversation.vectorStoreId}.`);
                    new Notice(`Failed to add note ${newNoteFile.basename} to AI context (VS add error).`);
                  }
                } else {
                   console.error(`ConversationManager.addNote: Failed to upload note ${newNoteFile.name} as a file or VS ID missing after creation.`);
                   new Notice(`Failed to add note ${newNoteFile.basename} to AI context (upload error or VS missing).`);
                }
              }
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error(`ConversationManager.addNote: Error processing file ${noteId} for vector store:`, error);
              new Notice(`Error processing note ${newNoteFile.basename} for AI context: ${errorMessage}`);
            }
        } else {
          console.warn(`ConversationManager.addNote: No Vector Store ID in current conversation or OpenAIService not available. Cannot upload/add file ${noteId}.`);
          if (!this.plugin.openAIService) new Notice ('AI Service not available.');
          else new Notice('Cannot add note to AI context: Current conversation has no Vector Store after creation attempt.');
        }
        if (contextPrepLabel) console.timeEnd(contextPrepLabel);
        
        this.currentConversation.noteIds.push(noteId);
        if (newNoteFile && this.currentConversation.contextNotes) { // Check newNoteFile and contextNotes
             this.currentConversation.contextNotes[noteId] = { title: newNoteFile.basename, included: true };
        }

        const activeTFiles = this.getActiveNotes(); 
        this.lastSentContextKey = this._generateContextKey(activeTFiles);
        console.log(`ConversationManager.addNote: New lastSentContextKey: ${this.lastSentContextKey}`);

        this.currentConversation.lastModified = new Date().toISOString();
        try {
          await this.storageService.updateConversation(this.currentConversation);
          console.log(`ConversationManager.addNote: Note ${noteId} processing complete, conversation updated in storage.`);
          if (fileAddedToVS) {
            new Notice(`Added note ${newNoteFile.basename} to context.`);
          } else if (this.currentConversation.noteIds.includes(noteId) && (!this.currentConversation.uploadedFileIds || !this.currentConversation.uploadedFileIds[noteId])) {
            new Notice(`Added note ${newNoteFile.basename} to list, but check AI context sync.`);
          }
        } catch (storageError) {
          console.error('ConversationManager.addNote: Failed to save conversation to storage after adding note:', storageError);
          new Notice('Error saving conversation after adding note.');
        }

        this.isLoading = false;
        this.setStatus(`Note ${newNoteFile.basename} processed.`);
        
    } catch (error: unknown) {
      console.error(`ConversationManager.addNote: Error adding note ${noteId}`, error);
      if (contextPrepLabel) console.timeEnd(contextPrepLabel); // End context prep timer on error
      this.error = `Failed to add note: ${error instanceof Error ? error.message : String(error)}`;
      this.setStatus('Error');
    } finally {
      this.isLoading = false; // Ensure isLoading is reset from true
      this.isProcessing = false;
      this.emit('update');
      if (!timerEnded) {
        console.timeEnd(addNoteTotalLabel);
      }
    }
  }

  @action
  public async removeNote(noteIdToRemove: string): Promise<void> {
    console.log(`ConversationManager.removeNote: Initiated for Note ID: ${noteIdToRemove}. Current VS ID: ${this.currentConversation?.vectorStoreId}`);
    if (!this.currentConversation || !this.plugin.openAIService) {
      console.warn('ConversationManager.removeNote: No current conversation or OpenAIService available.');
      return;
    }

    const { vectorStoreId, uploadedFileIds = {} } = this.currentConversation;
    const fileIdToRemove = uploadedFileIds[noteIdToRemove];

    console.log(`ConversationManager.removeNote: Old lastSentContextKey: ${this.lastSentContextKey}`);

    if (vectorStoreId && fileIdToRemove) {
      console.log(`ConversationManager.removeNote: Removing File ID: ${fileIdToRemove} (corresponds to note ${noteIdToRemove}) from Vector Store ${vectorStoreId}`);
      const removedFromVS = await this.plugin.openAIService.removeFileFromVectorStore(vectorStoreId, fileIdToRemove as string);
      
      if (removedFromVS) {
        console.log(`ConversationManager.removeNote: Successfully removed File ID ${fileIdToRemove} from Vector Store ${vectorStoreId}. Now attempting to delete the uploaded file itself.`);
        const fileDeleted = await this.plugin.openAIService.deleteUploadedFile(fileIdToRemove as string);
        if (fileDeleted) {
            console.log(`ConversationManager.removeNote: Successfully deleted uploaded File ID: ${fileIdToRemove}`);
        } else {
            console.warn(`ConversationManager.removeNote: Failed to delete uploaded File ID: ${fileIdToRemove} after removing from VS.`);
        }
      } else {
        console.warn(`ConversationManager.removeNote: Failed to remove File ID ${fileIdToRemove} from Vector Store ${vectorStoreId}.`);
        // Optionally, still try to delete the uploaded file if it exists and removal from VS failed, as it might be an orphan.
        // For now, we only delete if successfully removed from VS to avoid issues if VS removal failed due to file not being there.
      }
    } else {
      console.warn(`ConversationManager.removeNote: No Vector Store ID or File ID found for note ${noteIdToRemove}. Cannot remove from OpenAI. VS ID: ${vectorStoreId}, File ID: ${fileIdToRemove}`);
    }

    // Update local conversation state
    const indexToRemove = this.currentConversation.noteIds.findIndex(id => id === noteIdToRemove);
    if (indexToRemove !== -1) {
      this.currentConversation.noteIds.splice(indexToRemove, 1);
    }
    if (this.currentConversation.primaryNoteId === noteIdToRemove) {
        this.currentConversation.primaryNoteId = this.currentConversation.noteIds.length > 0 ? this.currentConversation.noteIds[0] : undefined;
    }
    if (this.currentConversation.uploadedFileIds) {
        delete this.currentConversation.uploadedFileIds[noteIdToRemove];
    }
    
    const activeTFiles = this.getActiveNotes();
    this.lastSentContextKey = this._generateContextKey(activeTFiles);
    console.log(`ConversationManager.removeNote: New lastSentContextKey: ${this.lastSentContextKey}`);

    try {
      await this.storageService.updateConversation(this.currentConversation);
      this.emit('update');
      console.log(`ConversationManager.removeNote: Note ${noteIdToRemove} removed from conversation and updated in storage.`);
    } catch (error: unknown) {
      console.error(`ConversationManager.removeNote: Error updating conversation in storage after removing note ${noteIdToRemove}:`, error);
      this.error = `Failed to update conversation: ${error instanceof Error ? error.message : String(error)}`;
      this.status = 'Error updating conversation';
      this.emit('update');
    }
  }
  
  @action
  public async saveCurrentConversationToNote(): Promise<TFile | null> {
    // (Logic largely the same as provided, ensure formatConversationForSaving is called correctly)
    try {
      if (!this.currentConversation) {
        // new Notice('No active conversation to save.'); // UI concern
        console.warn("ConversationManager: No active conversation to save.");
        return null;
      }
      const title = this.createFilename();
      const content = this.formatConversationForSaving(this.currentConversation);
      
      const file = await this.createNoteFromRawContent(title, content); // Uses the private method
      
      // new Notice(`Conversation saved to note: ${title}`); // UI concern
      console.log(`ConversationManager: Conversation saved to note ${title}`);
      return file;
    } catch (error) {
      console.error('Error saving conversation to note:', error);
      // new Notice(`Failed to save conversation: ${error.message || 'Unknown error'}`); // UI concern
      return null;
    }
  }

  private createFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    return `ChatNote History ${year}${month}${day}, ${hours}${minutes}${seconds}`;
  }

  private formatConversationForSaving(conversation: Conversation): string {
    // Get the actual current date when saving the note
    const saveTime = new Date();
    console.log('formatConversationForSaving: Current time when saving:', {
      isoString: saveTime.toISOString(),
      localString: saveTime.toString(),
      day: saveTime.getDate(),
      month: saveTime.getMonth() + 1,
      year: saveTime.getFullYear()
    });
    
    // Format for Properties section: Use ISO date format for better compatibility
    const createdDateProperty = saveTime.toISOString().split('T')[0]; // Gets YYYY-MM-DD format
    
    console.log('formatConversationForSaving: Properties created date:', createdDateProperty);

    // Generate conversation ID for footer (first 8 characters for readability)
    const shortConversationId = conversation.id.substring(0, 8);

    // Build content with proper Properties section
    let content = `---\n`;
    content += `created: ${createdDateProperty}\n`;
    content += `tags:\n  - NoteChat\n`;
    content += `---\n\n`;
    
    // Included Notes section (removed title line)
    content += `## Included Notes\n\n`;
    
    if (conversation.noteIds && conversation.noteIds.length > 0) {
      for (const noteId of conversation.noteIds) {
        const file = this.plugin.app.vault.getAbstractFileByPath(noteId);
        if (file instanceof TFile) {
          // Use just the note name without .md extension for cleaner links
          const noteName = file.basename;
          content += `- [[${noteName}]]\n`;
        } else {
          const noteName = noteId.split('/').pop()?.replace(/\.md$/, '') || noteId;
          content += `- ${noteName}\n`;
        }
      }
    } else {
      content += `No notes were included in this conversation.\n`;
    }
    
    content += `\n## Conversation Log\n\n`;
    
    // Format messages with consistent timestamp formatting
    for (const message of conversation.messages) {
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      const timestamp = new Date(message.timestamp).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      content += `### ${role} (${timestamp})\n\n`;
      content += `${message.content}\n\n`;
    }
    
    // Footer with consistent formatting
    const footerTimestamp = saveTime.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    content += `---\n`;
    content += `*Generated by Sonoria plugin on ${footerTimestamp} | Conversation ID: ${shortConversationId}*`;
    
    return content;
  }
  
  private async createNoteFromRawContent(title: string, content: string): Promise<TFile> {
    try {
      console.log('Creating note from raw content with title:', title);
      if (!title) throw new Error('Note title cannot be empty');
      if (!content) throw new Error('Note content cannot be empty');
      
      // Use conversation history directory setting for saving conversations
      const conversationDirectory = this.plugin.settings.conversationHistoryDirectory || '/NoteChat Conversations';
      console.log(`ConversationManager: Saving conversation to directory: ${conversationDirectory}`);
      
      const file = await this.noteService.createNoteInDirectory(title, content, conversationDirectory, true); // Suppress Notice from service
      console.log(`Note created successfully (notice suppressed by service): ${file.path}`);
      
      try {
        await this.noteService.openNote(file);
        console.log('Note opened successfully');
      } catch (openError) {
        console.error('Failed to open the created note:', openError);
      }
        return file; 
    } catch (err: unknown) {
      const specificErrorMessage = err instanceof Error ? err.message : String(err);
      this.error = `Failed to create note: ${specificErrorMessage}`;
      console.error('Failed to create note:', err);
      this.setStatus('Error creating note');
      // new Notice(`NoteChat: ${this.error}`); // UI concern
      throw err;
    }
  }
  
  public async createNoteFromContent(title: string, content: string): Promise<TFile> {
    // (Logic largely the same as provided, uses formatDateForNote)
    try {
      console.log('Creating note from content with title:', title);
      if (!title) throw new Error('Note title cannot be empty');
      if (!content) throw new Error('Note content cannot be empty');
      
      const formattedContent = 
        `# ${title}\n\n` + 
        content + 
        `\n\n---\n*Generated by NoteChat plugin on ${formatDateForNote(new Date())}*`; // Pass Date to formatDateForNote
      
      const file = await this.noteService.createNote(title, formattedContent); 
      
      try {
        await this.noteService.openNote(file);
        console.log('Note opened successfully');
      } catch (openError) {
        console.error('Failed to open the created note:', openError);
      }
      return file;
    } catch (err: unknown) {
      const specificErrorMessage = err instanceof Error ? err.message : String(err);
      this.error = `Failed to create note: ${specificErrorMessage}`;
      console.error('Failed to create note:', err);
      this.setStatus('Error creating note');
      // new Notice(`NoteChat: ${this.error}`); // UI Concern
      throw err;
    } finally {
      this.emit('update');
    }
  }

  getNoteService(): NoteService {
    return this.noteService;
  }

  @action
  private setStatus(status: string) {
    this.status = status;
    this.emit('update');
  }

  @action
  private setStreamingMessage(message: Message | null): void {
    this.streamingMessage = message;
    this.isStreaming = !!message;
    // 🛑 DEBUG: Keep isLoading true until streaming actually completes

    this.emit('update');
  }

  /**
   * Handles text-to-speech conversion for AI responses when voice input is enabled.
   * This method checks if voice features are enabled and TTS is available, then converts
   * the AI response text to speech and plays it back.
   * @param responseText The AI response text to convert to speech
   */
  private async handleTextToSpeech(responseText: string): Promise<void> {
    try {
      // Note: Voice features are always enabled in beta for showcasing capabilities

      // Check if we have OpenAIService available for TTS
      if (!this.plugin.openAIService || !this.plugin.openAIService.isAvailable()) {
        console.log('ConversationManager.handleTextToSpeech: OpenAI service not available, skipping TTS');
        return;
      }

      // Check if the response text is valid for TTS
      if (!responseText || responseText.trim().length === 0) {
        console.log('ConversationManager.handleTextToSpeech: Empty response text, skipping TTS');
        return;
      }

      // Import the audio playback utility
      const { playAudioBlob, getPreferredAudioFormat } = await import('@app/utils/audioPlayback');

      console.log('ConversationManager.handleTextToSpeech: Starting TTS conversion for response');
      
      // Update status to indicate TTS processing
      this.setStatus('Converting response to speech...');
      
      // Get preferred audio format for the current browser
      const preferredFormat = getPreferredAudioFormat();
      
      // 🔧 CITATION CLEANUP: Remove citation annotations as safety measure
      const cleanResponseText = removeCitationAnnotations(responseText);
      
      // Convert text to speech using OpenAI TTS
      const audioBlob = await this.plugin.openAIService.textToSpeech(cleanResponseText, {
        voice: 'alloy', // Default voice, could be configurable in the future
        format: preferredFormat,
        speed: 1.0
      });

      if (!audioBlob) {
        console.warn('ConversationManager.handleTextToSpeech: TTS conversion failed, no audio blob returned');
        this.setStatus('Text-to-speech conversion failed');
        return;
      }

      console.log('ConversationManager.handleTextToSpeech: TTS conversion successful, starting playback');
      
      // Set up voice state management for playback  
      const setVoiceState = (state: string) => {
        // Emit voice state change for UI components that listen to it
        this.emit('voiceStateChange', state);
      };

      // Play the audio with proper state management
      await playAudioBlob(
        audioBlob,
        setVoiceState,
        () => {
          // On completion
          console.log('ConversationManager.handleTextToSpeech: Audio playback completed');
          this.setStatus('Ready');
        },
        (error: Error) => {
          // On error
          console.error('ConversationManager.handleTextToSpeech: Audio playback error:', error);
          this.setStatus('Audio playback failed');
        }
      );

    } catch (error) {
      console.error('ConversationManager.handleTextToSpeech: Error during TTS processing:', error);
      this.setStatus('Text-to-speech error');
    }
  }

  /**
   * Clear the OpenAI file upload cache (useful for testing or when files change significantly)
   */
  public clearFileCache(): void {
    if (this.plugin.openAIService) {
      this.plugin.openAIService.clearFileCache();
      console.log('ConversationManager: File cache cleared');
    }
  }

  /**
   * Get file cache statistics for debugging
   */
  public getFileCacheStats(): { size: number; entries: string[] } | null {
    if (this.plugin.openAIService) {
      return this.plugin.openAIService.getCacheStats();
    }
    return null;
  }

  /**
   * Development method to log performance and cache statistics
   */
  public logPerformanceStats(): void {
    console.log('=== NoteChat Performance Stats ===');
    const cacheStats = this.getFileCacheStats();
    if (cacheStats) {
      console.log(`📁 File Cache: ${cacheStats.size} files cached`);
      console.log(`📋 Cached files:`, cacheStats.entries);
    }
    console.log(`💬 Current conversation: ${this.currentConversation?.id || 'None'}`);
    console.log(`📄 Notes in context: ${this.currentConversation?.noteIds?.length || 0}`);
    console.log(`🔗 Vector Store ID: ${this.currentConversation?.vectorStoreId || 'None'}`);
    console.log('===================================');
  }

  /**
   * Log expected timing benchmarks for performance monitoring
   */
  public logTimingBenchmarks(): void {
    console.log('=== NoteChat Timing Benchmarks ===');
    console.log('🎯 Expected Performance:');
    console.log('  • AI Response Start: 1.5-2.0 seconds');
    console.log('  • Context Prep (new): 3-7 seconds');
    console.log('  • Context Prep (cached): <100ms');
    console.log('  • File Upload (cached): <50ms');
    console.log('  • File Upload (new): 0.8-1.2 seconds');
    console.log('  • STT Transcription: 2-3 seconds');
    console.log('⚠️  Warning Thresholds:');
    console.log('  • AI Response Start >3s');
    console.log('  • Context Prep >10s');
    console.log('  • File Upload >2s');
    console.log('=====================================');
  }

  /**
   * Establish user gesture for autoplay permissions (called from voice recording)
   */
  public establishUserGestureForAutoplay(): void {
    if (this.progressiveAudioPlayback) {
      this.progressiveAudioPlayback.establishUserGesture();
      console.log('ConversationManager: User gesture established for autoplay');
    }
  }

  /**
   * Generate Progressive TTS on-demand for a specific message (text/dictation mode optimization)
   * This method processes the full message content through sentence extraction and TTS generation
   * @param messageContent - The full message text to process
   * @param messageId - The message ID to associate the audio with
   * @returns Promise that resolves when TTS generation is complete or fails
   */
  async generateProgressiveTTSOnDemand(messageContent: string, messageId: string): Promise<boolean> {
    if (!messageContent || messageContent.trim().length === 0) {
      console.warn('ConversationManager.generateProgressiveTTSOnDemand: Empty message content');
      return false;
    }

    console.log(`🎯 On-Demand Progressive TTS: Starting generation for message ${messageId}`);
    
    // 🎯 SET ON-DEMAND FLAG AND TRACKING: This ensures autoPlay works correctly for user-initiated TTS
    this.isOnDemandTTSActive = true;
    this.onDemandMessageId = messageId;
    this.onDemandCompletedSentences = 0;
    
    try {
      // Ensure Progressive TTS components are initialized
      if (!this.ensureProgressiveTTSInitialized() || !this.streamSentenceProcessor || !this.progressiveTTSQueue) {
        console.error('ConversationManager.generateProgressiveTTSOnDemand: Progressive TTS not properly initialized');
        return false;
      }

      // Create a temporary sentence processor for this message to count sentences
      let sentenceCount = 0;
      const tempProcessor = new StreamSentenceProcessor((sentence, isFirst) => {
        sentenceCount++;
        console.log(`🎯 On-Demand TTS: Processing sentence ${sentenceCount} ${isFirst ? '(first)' : ''}: "${sentence}"`);
        
        if (this.progressiveTTSQueue) {
          // Queue each sentence for TTS generation 
          // 🎯 CONSISTENCY FIX: Use same auto-play logic as voice mode for first sentence
          // The first sentence will auto-play when ready (same as voice mode behavior)
          console.log(`🎯 On-Demand TTS: Queueing sentence ${sentenceCount} for message ${messageId} (isFirst: ${isFirst})`);
          this.progressiveTTSQueue.queueSentence(sentence, messageId, isFirst);
        }
      });

      // 🔧 CITATION CLEANUP: Remove citation annotations as safety measure for saved messages
      const cleanMessageContent = removeCitationAnnotations(messageContent);
      
      // Process the entire message content through sentence extraction
      console.log(`🎯 On-Demand TTS: Processing full message content (${cleanMessageContent.length} chars)`);
      
      // Split the content into chunks and process (simulating streaming for sentence extraction)
      const chunkSize = 50; // Process in small chunks for better sentence boundary detection
      for (let i = 0; i < cleanMessageContent.length; i += chunkSize) {
        const chunk = cleanMessageContent.slice(i, i + chunkSize);
        tempProcessor.processTextChunk(chunk);
      }
      
      // Finalize to process any remaining partial sentences
      tempProcessor.finalize();
      
      // Set the expected sentence count for completion tracking
      this.onDemandExpectedSentences = sentenceCount;
      console.log(`🎯 On-Demand Progressive TTS: Sentence extraction complete for message ${messageId} - expecting ${sentenceCount} sentences`);
      
      return true;
      
    } catch (error) {
      console.error(`ConversationManager.generateProgressiveTTSOnDemand: Error generating TTS for message ${messageId}:`, error);
      // Clear on-demand state on error
      this.isOnDemandTTSActive = false;
      this.onDemandExpectedSentences = 0;
      this.onDemandCompletedSentences = 0;
      this.onDemandMessageId = null;
      return false;
    }
    // 🎯 REMOVED FIXED TIMEOUT: Now tracking completion properly via sentence count
    // The flag will be cleared automatically when all sentences are generated
  }
}