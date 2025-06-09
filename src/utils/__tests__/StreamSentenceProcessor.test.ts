import { StreamSentenceProcessor } from '../StreamSentenceProcessor';

describe('StreamSentenceProcessor', () => {
  let processor: StreamSentenceProcessor;
  let sentenceCallback: jest.Mock;

  beforeEach(() => {
    sentenceCallback = jest.fn();
    processor = new StreamSentenceProcessor(sentenceCallback);
  });

  afterEach(() => {
    processor.reset();
  });

  describe('processTextChunk', () => {
    it('should extract complete sentences from streaming text', () => {
      processor.processTextChunk('Hello world. This is a test.');
      
      expect(sentenceCallback).toHaveBeenCalledTimes(2);
      expect(sentenceCallback).toHaveBeenCalledWith('Hello world.', true); // First sentence
      expect(sentenceCallback).toHaveBeenCalledWith(' This is a test.', false);
    });

    it('should handle partial sentences across chunks', () => {
      processor.processTextChunk('Hello ');
      processor.processTextChunk('world. This ');
      processor.processTextChunk('is a test.');
      
      expect(sentenceCallback).toHaveBeenCalledTimes(2);
      expect(sentenceCallback).toHaveBeenCalledWith('Hello world.', true);
      expect(sentenceCallback).toHaveBeenCalledWith(' This is a test.', false);
    });

    it('should handle multiple punctuation marks', () => {
      processor.processTextChunk('Really?! Yes, indeed.');
      
      expect(sentenceCallback).toHaveBeenCalledTimes(2);
      expect(sentenceCallback).toHaveBeenCalledWith('Really?!', true);
      expect(sentenceCallback).toHaveBeenCalledWith(' Yes, indeed.', false);
    });

    it('should skip abbreviations', () => {
      processor.processTextChunk('Dr. Smith said hello. How are you?');
      
      expect(sentenceCallback).toHaveBeenCalledTimes(2);
      expect(sentenceCallback).toHaveBeenCalledWith('Dr. Smith said hello.', true);
      expect(sentenceCallback).toHaveBeenCalledWith(' How are you?', false);
    });

    it('should handle decimal numbers correctly', () => {
      processor.processTextChunk('The price is $3.14 today. Great deal!');
      
      expect(sentenceCallback).toHaveBeenCalledTimes(2);
      expect(sentenceCallback).toHaveBeenCalledWith('The price is $3.14 today.', true);
      expect(sentenceCallback).toHaveBeenCalledWith(' Great deal!', false);
    });

    it('should not extract very short sentences', () => {
      processor.processTextChunk('Hi. Okay then.');
      
      // Should not extract "Hi." as it's too short, but should extract "Okay then."
      expect(sentenceCallback).toHaveBeenCalledTimes(1);
      expect(sentenceCallback).toHaveBeenCalledWith(' Okay then.', true);
    });
  });

  describe('finalize', () => {
    it('should process remaining buffer as final sentence', () => {
      processor.processTextChunk('Hello world. This is incomplete');
      processor.finalize();
      
      expect(sentenceCallback).toHaveBeenCalledTimes(2);
      expect(sentenceCallback).toHaveBeenCalledWith('Hello world.', true);
      expect(sentenceCallback).toHaveBeenCalledWith('This is incomplete', false);
    });

    it('should return null if no remaining text', () => {
      processor.processTextChunk('Hello world.');
      const result = processor.finalize();
      
      expect(result).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear buffer and reset first sentence flag', () => {
      processor.processTextChunk('Hello ');
      processor.reset();
      processor.processTextChunk('World.');
      
      expect(sentenceCallback).toHaveBeenCalledTimes(1);
      expect(sentenceCallback).toHaveBeenCalledWith('World.', true); // Should be first again
    });
  });

  describe('getCurrentBuffer', () => {
    it('should return current buffer content', () => {
      processor.processTextChunk('Hello ');
      processor.processTextChunk('world incomplete');
      
      expect(processor.getCurrentBuffer()).toBe('Hello world incomplete');
    });
  });
}); 