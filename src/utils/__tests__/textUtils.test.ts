/**
 * Unit tests for text processing utilities
 */

import {
  countWords,
  shouldMessageBeCollapsible,
  truncateToWords,
  estimateReadingTime,
  extractTextPreview,
  analyzeMessageContent,
  removeCitationAnnotations
} from '../textUtils';

describe('textUtils', () => {
  describe('countWords', () => {
    it('should count words in plain text', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('This is a test message')).toBe(5);
      expect(countWords('Single')).toBe(1);
    });

    it('should handle edge cases', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords(null as unknown as string)).toBe(0);
      expect(countWords(undefined as unknown as string)).toBe(0);
    });

    it('should handle markdown syntax', () => {
      expect(countWords('**Bold text** and *italic text*')).toBe(5);
      expect(countWords('# Header\nSome content')).toBe(3);
      expect(countWords('`inline code` and regular text')).toBe(3); // "and regular text" = 3 words after removing code
      expect(countWords('[Link text](http://example.com)')).toBe(2);
    });

    it('should handle code blocks', () => {
      const codeBlockText = `
Here is some text before
\`\`\`javascript
function example() {
  console.log("hello");
}
\`\`\`
And some text after
      `;
      expect(countWords(codeBlockText)).toBe(9); // Excludes code block content
    });

    it('should handle HTML tags', () => {
      expect(countWords('<p>Hello <strong>world</strong></p>')).toBe(2);
      expect(countWords('<div><span>Test content</span></div>')).toBe(2);
    });

    it('should handle multiple whitespace', () => {
      expect(countWords('Hello    world   test')).toBe(3);
      expect(countWords('Word1\n\nWord2\t\tWord3')).toBe(3);
    });

    it('should handle Chinese/CJK text correctly', () => {
      // Pure Chinese text (from the user's example)
      const chineseText = '从文件中可以看出，储能行业在全球各地的发展情况有所差异，主要涉及中国、欧洲、美国和中东地区。';
      const wordCount = countWords(chineseText);
      expect(wordCount).toBeGreaterThan(15); // Should count CJK characters appropriately
      expect(wordCount).toBeLessThan(35); // But not too high
      
      // Mixed Chinese and English
      const mixedText = 'Hello 世界 world 测试 test';
      expect(countWords(mixedText)).toBeGreaterThan(4);
      
      // Pure English for comparison
      expect(countWords('The energy storage industry development varies globally')).toBe(7);
    });
  });

  describe('shouldMessageBeCollapsible', () => {
    it('should return false for short messages', () => {
      const shortMessage = 'This is a short message with few words';
      expect(shouldMessageBeCollapsible(shortMessage, 30)).toBe(false);
    });

    it('should return true for long messages', () => {
      const longMessage = Array(35).fill('word').join(' ');
      expect(shouldMessageBeCollapsible(longMessage, 30)).toBe(true);
    });

    it('should use custom threshold', () => {
      const message = Array(15).fill('word').join(' ');
      expect(shouldMessageBeCollapsible(message, 10)).toBe(true);
      expect(shouldMessageBeCollapsible(message, 20)).toBe(false);
    });

    it('should handle edge case at threshold', () => {
      const exactThresholdMessage = Array(30).fill('word').join(' ');
      expect(shouldMessageBeCollapsible(exactThresholdMessage, 30)).toBe(false);
      
      const overThresholdMessage = Array(31).fill('word').join(' ');
      expect(shouldMessageBeCollapsible(overThresholdMessage, 30)).toBe(true);
    });
  });

  describe('truncateToWords', () => {
    it('should truncate text to word limit', () => {
      const text = 'This is a test message with more than five words';
      expect(truncateToWords(text, 5)).toBe('This is a test message...');
    });

    it('should not truncate if under limit', () => {
      const text = 'Short message';
      expect(truncateToWords(text, 5)).toBe('Short message');
    });

    it('should use custom suffix', () => {
      const text = 'This is a longer message';
      expect(truncateToWords(text, 3, ' [more]')).toBe('This is a [more]');
    });

    it('should handle empty input', () => {
      expect(truncateToWords('', 5)).toBe('');
      expect(truncateToWords(null as unknown as string, 5)).toBe('');
    });

    it('should handle exact word count', () => {
      const text = 'One two three four five';
      expect(truncateToWords(text, 5)).toBe('One two three four five');
    });
  });

  describe('estimateReadingTime', () => {
    it('should estimate reading time for normal text', () => {
      const text = Array(200).fill('word').join(' '); // Exactly 200 words
      expect(estimateReadingTime(text)).toBe(1);
    });

    it('should round up to minimum 1 minute', () => {
      expect(estimateReadingTime('Short text')).toBe(1);
      expect(estimateReadingTime('')).toBe(1);
    });

    it('should handle longer texts', () => {
      const text = Array(450).fill('word').join(' '); // 450 words
      expect(estimateReadingTime(text)).toBe(3); // 450/200 = 2.25, rounds up to 3
    });
  });

  describe('extractTextPreview', () => {
    it('should extract preview from short text', () => {
      const text = 'Short text';
      expect(extractTextPreview(text, 100)).toBe('Short text');
    });

    it('should break at sentence boundary', () => {
      const text = 'First sentence. Second sentence with more content.';
      expect(extractTextPreview(text, 20)).toBe('First sentence.');
    });

    it('should truncate at word boundary when no sentence break', () => {
      const text = 'This is a very long sentence without any periods or other sentence endings';
      const preview = extractTextPreview(text, 30);
      expect(preview).toContain('...');
      expect(preview.length).toBeLessThanOrEqual(35); // 30 + '...'
    });

    it('should handle markdown and HTML', () => {
      const text = '```code block``` and `inline code` with **bold** text';
      const preview = extractTextPreview(text, 50);
      expect(preview).toBe('[code block] and [code] with bold text');
    });

    it('should handle empty input', () => {
      expect(extractTextPreview('', 100)).toBe('');
      expect(extractTextPreview(null as unknown as string, 100)).toBe('');
    });
  });

  describe('analyzeMessageContent', () => {
    it('should analyze short message correctly', () => {
      const content = 'This is a short message';
      const analysis = analyzeMessageContent(content);
      
      expect(analysis.shouldCollapse).toBe(false);
      expect(analysis.wordCount).toBe(5);
      expect(analysis.estimatedReadingTime).toBe(1);
      expect(analysis.preview).toBe('This is a short message');
      expect(analysis.truncatedContent).toBe('This is a short message');
    });

    it('should analyze long message correctly', () => {
      const content = Array(35).fill('word').join(' ');
      const analysis = analyzeMessageContent(content);
      
      expect(analysis.shouldCollapse).toBe(true);
      expect(analysis.wordCount).toBe(35);
      expect(analysis.estimatedReadingTime).toBe(1);
      expect(analysis.truncatedContent).toContain('...');
    });

    it('should use custom options', () => {
      const content = Array(20).fill('word').join(' ');
      const analysis = analyzeMessageContent(content, {
        wordThreshold: 15,
        truncateWords: 10
      });
      
      expect(analysis.shouldCollapse).toBe(true);
      expect(analysis.truncatedContent).toBe(Array(10).fill('word').join(' ') + '...');
    });

    it('should handle markdown content', () => {
      const content = `
# Header
This is **bold** text with \`code\` and more content.
\`\`\`javascript
function test() {}
\`\`\`
Additional content after code block.
      `.trim();
      
      const analysis = analyzeMessageContent(content);
      expect(analysis.wordCount).toBeGreaterThan(0);
      expect(analysis.preview).not.toContain('```');
    });

    it('should return proper interface structure', () => {
      const content = 'Test content';
      const analysis = analyzeMessageContent(content);
      
      // Verify all required properties exist
      expect(analysis).toHaveProperty('shouldCollapse');
      expect(analysis).toHaveProperty('wordCount');
      expect(analysis).toHaveProperty('estimatedReadingTime');
      expect(analysis).toHaveProperty('preview');
      expect(analysis).toHaveProperty('truncatedContent');
      
      // Verify types
      expect(typeof analysis.shouldCollapse).toBe('boolean');
      expect(typeof analysis.wordCount).toBe('number');
      expect(typeof analysis.estimatedReadingTime).toBe('number');
      expect(typeof analysis.preview).toBe('string');
      expect(typeof analysis.truncatedContent).toBe('string');
    });
  });

  describe('removeCitationAnnotations', () => {
    it('should remove citation annotations from English text', () => {
      const textWithCitations = 'This is useful information【4:0†file.md】【4:11†document.txt】.';
      const cleanText = removeCitationAnnotations(textWithCitations);
      expect(cleanText).toBe('This is useful information.');
    });

    it('should remove citation annotations from Chinese text', () => {
      const textWithChineseCitations = '这是有用的信息【4:4†《发现，而非设计》4：万变不离其宗 - 得到APP.md】，还有更多内容【4:13†《发现，而非设计》5：还原论人才和整体论人才 - 得到APP.md】。';
      const cleanText = removeCitationAnnotations(textWithChineseCitations);
      expect(cleanText).toBe('这是有用的信息，还有更多内容。');
    });

    it('should remove multiple citations throughout text', () => {
      const textWithMultiple = 'First point【1:5†source.pdf】, second point【22:0†data.xlsx】, and third【333:99†notes.md】.';
      const cleanText = removeCitationAnnotations(textWithMultiple);
      expect(cleanText).toBe('First point, second point, and third.');
    });

    it('should handle text without citations', () => {
      const textWithoutCitations = 'This is plain text without any annotations.';
      const cleanText = removeCitationAnnotations(textWithoutCitations);
      expect(cleanText).toBe('This is plain text without any annotations.');
    });

    it('should handle edge cases', () => {
      expect(removeCitationAnnotations('')).toBe('');
      expect(removeCitationAnnotations(null as unknown as string)).toBe(null);
      expect(removeCitationAnnotations(undefined as unknown as string)).toBe(undefined);
    });

    it('should only remove exact citation format', () => {
      // Should not remove similar but different patterns
      const textWithSimilar = 'Text with [4:0†source] and (4:11†source) but not citations.';
      const cleanText = removeCitationAnnotations(textWithSimilar);
      expect(cleanText).toBe('Text with [4:0†source] and (4:11†source) but not citations.');
    });

    it('should handle large file IDs and chunk IDs', () => {
      const textWithLargeCitations = 'Information【999999:123456†source】 is accurate.';
      const cleanText = removeCitationAnnotations(textWithLargeCitations);
      expect(cleanText).toBe('Information is accurate.');
    });

    it('should handle citations at text boundaries', () => {
      const startCitation = '【1:0†source】This starts with citation.';
      expect(removeCitationAnnotations(startCitation)).toBe('This starts with citation.');

      const endCitation = 'This ends with citation【99:1†source】';
      expect(removeCitationAnnotations(endCitation)).toBe('This ends with citation');

      const onlyCitation = '【42:7†source】';
      expect(removeCitationAnnotations(onlyCitation)).toBe('');
    });

    it('should handle real-world example from task brief', () => {
      const realExample = `1.  **Reduction of Dependency on Advertising**: The current ad-supported model has been criticized for creating poor-quality content driven by incentives that prioritize clicks over genuine value. Authors suggest that by allowing customers to pay directly, the emphasis can shift toward enriching content quality rather than catering to advertisers【4:0†source】【4:11†source】.
2.  **More Meaningful Engagement**: Direct payments can foster a closer relationship between content creators and their audiences. Subscribers are essentially paying for value rather than simply accessing free content laden with ads, which can often lead to disappointment or feelings of being manipulated【4:1†source】.`;

      const cleanExample = removeCitationAnnotations(realExample);
      
      expect(cleanExample).not.toContain('【');
      expect(cleanExample).not.toContain('†source');
      expect(cleanExample).not.toContain('】');
      expect(cleanExample).toContain('**Reduction of Dependency on Advertising**');
      expect(cleanExample).toContain('**More Meaningful Engagement**');
      expect(cleanExample).toContain('catering to advertisers.');
      expect(cleanExample).toContain('feelings of being manipulated.');
    });
  });
}); 