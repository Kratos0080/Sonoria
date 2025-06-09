/**
 * StreamSentenceProcessor extracts complete sentences from streaming text chunks
 * for progressive TTS generation. Handles partial sentences across chunks and
 * provides intelligent sentence boundary detection.
 */
export class StreamSentenceProcessor {
  private buffer: string = '';
  private onSentenceComplete: (sentence: string, isFirst: boolean) => void;
  private firstSentenceEmitted: boolean = false;

  constructor(onSentenceComplete: (sentence: string, isFirst: boolean) => void) {
    this.onSentenceComplete = onSentenceComplete;
  }

  /**
   * Process a text chunk from streaming and extract complete sentences
   * @param chunk - The text chunk from streaming
   * @returns Array of complete sentences found in this chunk
   */
  processTextChunk(chunk: string): string[] {
    console.log(`StreamSentenceProcessor: Processing chunk: "${chunk}"`);
    
    if (!chunk) {
      console.log('StreamSentenceProcessor: Empty chunk, returning empty array');
      return [];
    }

    this.buffer += chunk;
    console.log(`StreamSentenceProcessor: Updated buffer: "${this.buffer}"`);
    
    // Extract complete sentences using intelligent boundary detection
    const sentences = this.extractCompleteSentences(this.buffer);
    console.log(`StreamSentenceProcessor: Extracted ${sentences.length} sentences:`, sentences);
    
    if (sentences.length > 0) {
      sentences.forEach((sentence, index) => {
        const isFirstSentence = !this.firstSentenceEmitted && index === 0;
        if (isFirstSentence) {
          this.firstSentenceEmitted = true;
        }
        // Trim only sentences that don't start with a space (i.e., the very first sentence)
        // Preserve spacing for all sentences that start with a space
        const processedSentence = sentence.startsWith(' ') ? sentence : sentence.trim();
        console.log(`StreamSentenceProcessor: Calling callback for sentence ${index}: "${processedSentence}" (isFirst: ${isFirstSentence})`);
        this.onSentenceComplete(processedSentence, isFirstSentence);
      });
      
      // Update buffer with remaining text after removing complete sentences
      const remainingText = this.getRemainingText(this.buffer, sentences);
      console.log(`StreamSentenceProcessor: Remaining text in buffer: "${remainingText}"`);
      this.buffer = remainingText;
    } else {
      console.log('StreamSentenceProcessor: No complete sentences found, keeping text in buffer');
    }
    
    return sentences;
  }

  /**
   * Extract complete sentences from text, handling edge cases
   * @param text - Text to extract sentences from
   * @returns Array of complete sentences
   */
  private extractCompleteSentences(text: string): string[] {
    console.log(`StreamSentenceProcessor.extractCompleteSentences: Processing text: "${text}"`);
    
    try {
      // Smart sentence detection pattern that handles:
      // - Abbreviations (Dr., Mr., etc.)
      // - Decimal numbers (3.14)
      // - Multiple punctuation (?!, ...)
      // - Ellipsis (...)
      const sentencePattern = /[.!?]+(?:\s|$)/g;
      const sentences: string[] = [];
      let lastIndex = 0;
      let match;

      console.log(`StreamSentenceProcessor.extractCompleteSentences: Starting regex matching`);
      while ((match = sentencePattern.exec(text)) !== null) {
        try {
          console.log(`StreamSentenceProcessor.extractCompleteSentences: Found match at index ${match.index}: "${match[0]}"`);
          
          const punctuationEnd = match.index + match[0].replace(/\s+$/, '').length; // End of punctuation, not including trailing space
          const rawSentence = text.substring(lastIndex, punctuationEnd);
          const trimmedSentence = rawSentence.trim();
          
          console.log(`StreamSentenceProcessor.extractCompleteSentences: Raw sentence: "${rawSentence}", Trimmed: "${trimmedSentence}"`);
          
          // Skip if it's likely an abbreviation (very short with period)
          if (this.isLikelyAbbreviation(trimmedSentence)) {
            console.log(`StreamSentenceProcessor.extractCompleteSentences: Skipping abbreviation: "${trimmedSentence}"`);
            continue;
          }
          
          // Only add sentences that have meaningful content (more than 3 chars when trimmed)
          if (trimmedSentence.length > 3) {
            // Always preserve the original spacing structure from the text
            console.log(`StreamSentenceProcessor.extractCompleteSentences: Adding sentence: "${rawSentence}"`);
            sentences.push(rawSentence);
            lastIndex = punctuationEnd; // Start next sentence from end of punctuation
          } else {
            // Even if we don't add the sentence, move lastIndex forward to skip it
            console.log(`StreamSentenceProcessor.extractCompleteSentences: Skipping short sentence: "${trimmedSentence}"`);
            lastIndex = punctuationEnd;
          }
        } catch (matchError) {
          console.error(`StreamSentenceProcessor.extractCompleteSentences: Error processing match at index ${match.index}:`, matchError);
          // Try to continue processing
          break;
        }
      }

      console.log(`StreamSentenceProcessor.extractCompleteSentences: Completed, found ${sentences.length} sentences`);
      return sentences;
    } catch (error) {
      console.error(`StreamSentenceProcessor.extractCompleteSentences: Critical error in sentence extraction:`, error);
      return []; // Return empty array on critical error
    }
  }

  /**
   * Check if a potential sentence is likely an abbreviation
   * @param sentence - The potential sentence to check
   * @returns True if likely an abbreviation
   */
  private isLikelyAbbreviation(sentence: string): boolean {
    const trimmed = sentence.trim();
    
    // Common abbreviations
    const abbreviations = [
      'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'vs.', 'etc.', 'i.e.', 'e.g.',
      'Inc.', 'Corp.', 'Ltd.', 'Co.', 'Jr.', 'Sr.', 'Ph.D.', 'M.D.'
    ];
    
    // Check for exact matches with common abbreviations
    if (abbreviations.some(abbr => trimmed.toLowerCase() === abbr.toLowerCase())) {
      return true;
    }
    
    // Check for single letter followed by period (initials)
    if (/^[A-Za-z]\.$/.test(trimmed)) {
      return true;
    }
    
    // Check for decimal numbers
    if (/^\d+\.\d*$/.test(trimmed.replace(/[^\d.]/g, ''))) {
      return true;
    }
    
    return false;
  }

  /**
   * Get remaining text after removing complete sentences
   * @param originalText - The original text buffer
   * @param extractedSentences - The sentences that were extracted
   * @returns Remaining text that hasn't formed complete sentences yet
   */
  private getRemainingText(originalText: string, extractedSentences: string[]): string {
    if (extractedSentences.length === 0) {
      return originalText;
    }
    
    // Find the end position of all extracted sentences by re-parsing
    // We need to use the same regex logic to find where sentences actually end
    const sentencePattern = /[.!?]+(?:\s|$)/g;
    let lastProcessedIndex = 0;
    let sentencesFound = 0;
    let match;

    while ((match = sentencePattern.exec(originalText)) !== null && sentencesFound < extractedSentences.length) {
      const punctuationEnd = match.index + match[0].replace(/\s+$/, '').length;
      const rawSentence = originalText.substring(lastProcessedIndex, punctuationEnd);
      const trimmedSentence = rawSentence.trim();
      
      // Skip abbreviations same as in extractCompleteSentences
      if (this.isLikelyAbbreviation(trimmedSentence)) {
        continue;
      }
      
      // If this is a meaningful sentence (same criteria as extraction)
      if (trimmedSentence.length > 3) {
        sentencesFound++;
        lastProcessedIndex = punctuationEnd;
      } else {
        // Move past short sentences too
        lastProcessedIndex = punctuationEnd;
      }
    }
    
    // Don't skip trailing whitespace - it should be part of the next sentence
    return originalText.substring(lastProcessedIndex);
  }

  /**
   * Finalize processing - handle any remaining text as the last sentence
   * @returns The final sentence if any text remains in buffer
   */
  finalize(): string | null {
    if (this.buffer.trim().length > 0) {
      const finalSentence = this.buffer.trim();
      this.onSentenceComplete(finalSentence, !this.firstSentenceEmitted);
      this.buffer = '';
      return finalSentence;
    }
    return null;
  }

  /**
   * Reset the processor for a new stream
   */
  reset(): void {
    this.buffer = '';
    this.firstSentenceEmitted = false;
  }

  /**
   * Get current buffer content (for debugging)
   */
  getCurrentBuffer(): string {
    return this.buffer;
  }
} 