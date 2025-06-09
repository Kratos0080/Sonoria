import { nanoid } from 'nanoid';

/**
 * Task for sentence-level TTS processing
 */
interface TTSSentenceTask {
  id: string;
  sentence: string;
  priority: number; // 1 = highest (first sentence), 2+ = background
  messageId: string;
  sequenceIndex: number;
  timestamp: number;
}

/**
 * TTS Queue events for external listeners
 */
export interface ProgressiveTTSEvents {
  sentenceGenerated: (messageId: string, sequenceIndex: number, audioBlob: Blob, isFirstSentence: boolean) => void;
  firstSentenceReady: (messageId: string, audioBlob: Blob) => void;
  queueCompleted: (messageId: string) => void;
  error: (messageId: string, error: string, sentence: string) => void;
}

/**
 * ProgressiveTTSQueue manages sentence-level TTS generation with priority processing.
 * First sentences get immediate processing while subsequent sentences are processed
 * in the background. Integrates with caching for performance optimization.
 */
export class ProgressiveTTSQueue {
  private queue: TTSSentenceTask[] = [];
  private processing: Set<string> = new Set();
  private messageSequences: Map<string, number> = new Map(); // Track sequence index per message
  private listeners: Partial<ProgressiveTTSEvents> = {};
  private isProcessing: boolean = false;

  constructor(
    private openAIService: { textToSpeech: (text: string, options?: { voice?: string; format?: string }) => Promise<Blob | null> },
    private cache?: { get: (key: string) => Promise<Blob | null>; set: (key: string, blob: Blob) => Promise<void> }
  ) {}

  /**
   * Set up event listeners for TTS queue events
   * @param event - Event name to listen for
   * @param callback - Callback function for the event
   */
  on<K extends keyof ProgressiveTTSEvents>(event: K, callback: ProgressiveTTSEvents[K]): void {
    this.listeners[event] = callback;
  }

  /**
   * Remove event listener
   * @param event - Event name to remove listener for
   */
  off<K extends keyof ProgressiveTTSEvents>(event: K): void {
    delete this.listeners[event];
  }

  /**
   * Queue a sentence for TTS processing
   * @param sentence - The sentence text to convert to speech
   * @param messageId - The message this sentence belongs to
   * @param isFirstSentence - Whether this is the first sentence (gets priority)
   * @returns Promise that resolves when queuing is complete
   */
  async queueSentence(
    sentence: string, 
    messageId: string, 
    isFirstSentence: boolean
  ): Promise<void> {
    if (!sentence || sentence.trim().length === 0) {
      console.warn('ProgressiveTTSQueue: Empty sentence ignored');
      return;
    }

    const priority = isFirstSentence ? 1 : 2;
    const sequenceIndex = this.getNextSequenceIndex(messageId);

    // Check cache first if available
    if (this.cache) {
      const cacheKey = this.generateCacheKey(sentence);
      const cachedAudio = await this.cache.get(cacheKey);
      
      if (cachedAudio) {
        console.log(`ProgressiveTTSQueue: Cache hit for sentence ${sequenceIndex} in message ${messageId}`);
        this.emitSentenceGenerated(messageId, sequenceIndex, cachedAudio, isFirstSentence);
        return;
      }
    }

    const task: TTSSentenceTask = {
      id: nanoid(),
      sentence,
      priority,
      messageId,
      sequenceIndex,
      timestamp: Date.now()
    };

    this.queue.push(task);
    this.sortQueue();
    
    console.log(`ProgressiveTTSQueue: Queued sentence ${sequenceIndex} for message ${messageId} (priority: ${priority})`);
    
    // Process queue without blocking
    this.processQueueAsync();
  }

  /**
   * Get the next sequence index for a message
   */
  private getNextSequenceIndex(messageId: string): number {
    const currentIndex = this.messageSequences.get(messageId) || 0;
    const nextIndex = currentIndex;
    this.messageSequences.set(messageId, currentIndex + 1);
    return nextIndex;
  }

  /**
   * Sort queue by priority (1 = highest priority)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower number = higher priority
      }
      // Same priority: sort by timestamp (FIFO)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Process the queue asynchronously without blocking
   */
  private async processQueueAsync(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task) break;

        try {
          await this.processTask(task);
        } catch (error) {
          console.error(`ProgressiveTTSQueue: Error processing task ${task.id}:`, error);
          this.emitError(task.messageId, error instanceof Error ? error.message : 'Unknown error', task.sentence);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single TTS task
   */
  private async processTask(task: TTSSentenceTask): Promise<void> {
    if (this.processing.has(task.id)) {
      return; // Already processing
    }

    this.processing.add(task.id);
    
    try {
      console.log(`ProgressiveTTSQueue: Processing sentence ${task.sequenceIndex} for message ${task.messageId}`);
      
      const audioBlob = await this.generateTTSWithStreaming(task.sentence);
      
      if (audioBlob) {
        // Cache the result if caching is available
        if (this.cache) {
          const cacheKey = this.generateCacheKey(task.sentence);
          await this.cache.set(cacheKey, audioBlob);
        }
        
        const isFirstSentence = task.priority === 1;
        this.emitSentenceGenerated(task.messageId, task.sequenceIndex, audioBlob, isFirstSentence);
        
        console.log(`ProgressiveTTSQueue: Generated audio for sentence ${task.sequenceIndex} in message ${task.messageId}`);
      } else {
        throw new Error('TTS generation returned null');
      }
    } finally {
      this.processing.delete(task.id);
    }
  }

  /**
   * Generate TTS audio for a sentence, with streaming support if available
   */
  private async generateTTSWithStreaming(sentence: string): Promise<Blob | null> {
    try {
      // Use the existing OpenAI TTS service
      // Note: OpenAI TTS API doesn't currently support streaming for audio generation
      // But we can still optimize by using the existing efficient implementation
      const audioBlob = await this.openAIService.textToSpeech(sentence, {
        voice: 'alloy',
        format: 'mp3'
      });
      
      return audioBlob;
    } catch (error) {
      console.error('ProgressiveTTSQueue: TTS generation error:', error);
      return null;
    }
  }

  /**
   * Generate cache key for a sentence
   */
  private generateCacheKey(sentence: string): string {
    // Normalize sentence for caching (remove extra whitespace, lowercase)
    const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
    return `tts_${this.hashString(normalized)}_alloy_mp3`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Emit sentence generated event
   */
  private emitSentenceGenerated(messageId: string, sequenceIndex: number, audioBlob: Blob, isFirstSentence: boolean): void {
    if (this.listeners.sentenceGenerated) {
      this.listeners.sentenceGenerated(messageId, sequenceIndex, audioBlob, isFirstSentence);
    }
    
    if (isFirstSentence && this.listeners.firstSentenceReady) {
      this.listeners.firstSentenceReady(messageId, audioBlob);
    }
  }

  /**
   * Emit error event
   */
  private emitError(messageId: string, error: string, sentence: string): void {
    if (this.listeners.error) {
      this.listeners.error(messageId, error, sentence);
    }
  }

  /**
   * Clear all tasks for a specific message (useful for cancellation)
   */
  clearMessage(messageId: string): void {
    this.queue = this.queue.filter(task => task.messageId !== messageId);
    this.messageSequences.delete(messageId);
    console.log(`ProgressiveTTSQueue: Cleared all tasks for message ${messageId}`);
  }

  /**
   * Get queue statistics for monitoring
   */
  getStats(): { queueLength: number; processingCount: number; messageCount: number } {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      messageCount: this.messageSequences.size
    };
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.messageSequences.clear();
    console.log('ProgressiveTTSQueue: Cleared all tasks');
  }
} 