/**
 * Unit tests for CollapsibleMessage component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleMessage } from '../CollapsibleMessage';
import { VoiceMode } from '../../context/VoiceContext';

// Mock the useVoiceModeCheck hook
jest.mock('../../context/VoiceModeContext', () => ({
  useVoiceModeCheck: jest.fn(),
  useVoiceMode: jest.fn()
}));

import * as VoiceModeContext from '../../context/VoiceModeContext';

const mockUseVoiceModeCheck = VoiceModeContext.useVoiceModeCheck as jest.Mock;

// Helper to set up voice mode mock
const setupVoiceModeMock = (voiceMode: VoiceMode = VoiceMode.TEXT_ONLY) => {
  mockUseVoiceModeCheck.mockReturnValue({
    voiceMode,
    isVoiceConversationMode: voiceMode === VoiceMode.VOICE_CONVERSATION,
    isDictationMode: voiceMode === VoiceMode.DICTATION,
    isVoiceMode: voiceMode === VoiceMode.VOICE_CONVERSATION,
  });
};

describe('CollapsibleMessage', () => {
  const shortContent = 'This is a short message';
  const longContent = Array(40).fill('word').join(' '); // 40 words, should be collapsible

  beforeEach(() => {
    setupVoiceModeMock(VoiceMode.TEXT_ONLY);
  });

  describe('Basic functionality', () => {
    it('renders short content without collapsible controls', () => {
      render(<CollapsibleMessage content={shortContent} />);

      expect(screen.getByText(shortContent)).toBeInTheDocument();
      expect(screen.queryByText('Show More')).not.toBeInTheDocument();
      expect(screen.queryByText('Show Less')).not.toBeInTheDocument();
    });

    it('renders long content with collapsible controls', () => {
      render(<CollapsibleMessage content={longContent} />);

      expect(screen.getByText('Show More')).toBeInTheDocument();
      expect(screen.getByText(/40 words/)).toBeInTheDocument();
      expect(screen.queryByText('Show Less')).not.toBeInTheDocument();
    });

    it('expands content when Show More is clicked', () => {
      render(<CollapsibleMessage content={longContent} />);

      const showMoreButton = screen.getByText('Show More');
      fireEvent.click(showMoreButton);

      expect(screen.getByText('Show Less')).toBeInTheDocument();
      expect(screen.queryByText('Show More')).not.toBeInTheDocument();
    });

    it('collapses content when Show Less is clicked', () => {
      render(<CollapsibleMessage content={longContent} />);

      // First expand
      fireEvent.click(screen.getByText('Show More'));
      expect(screen.getByText('Show Less')).toBeInTheDocument();

      // Then collapse
      fireEvent.click(screen.getByText('Show Less'));
      expect(screen.getByText('Show More')).toBeInTheDocument();
      expect(screen.queryByText('Show Less')).not.toBeInTheDocument();
    });
  });

  describe('Custom thresholds', () => {
    it('respects custom word threshold', () => {
      const mediumContent = Array(20).fill('word').join(' '); // 20 words
      
      // Should not be collapsible with default threshold (30)
      const { rerender } = render(<CollapsibleMessage content={mediumContent} />);
      expect(screen.queryByText('Show More')).not.toBeInTheDocument();

      // Should be collapsible with custom threshold (15)
      rerender(<CollapsibleMessage content={mediumContent} wordThreshold={15} />);
      expect(screen.getByText('Show More')).toBeInTheDocument();
    });

    it('respects custom truncate words limit', () => {
      render(<CollapsibleMessage content={longContent} truncateWords={5} />);

      // Should show only first 5 words + ellipsis
      const contentElement = screen.getByText(/word word word word word\.\.\./);
      expect(contentElement).toBeInTheDocument();
    });
  });

  describe('Force states', () => {
    it('respects forceCollapsed prop', () => {
      render(<CollapsibleMessage content={shortContent} forceCollapsed={true} />);
      expect(screen.getByText('Show More')).toBeInTheDocument();
    });

    it('respects disableCollapse prop', () => {
      render(<CollapsibleMessage content={longContent} disableCollapse={true} />);
      expect(screen.queryByText('Show More')).not.toBeInTheDocument();
    });
  });

  describe('Voice mode integration', () => {
    it('uses consistent threshold across all modes', () => {
      const mediumContent = Array(25).fill('word').join(' '); // 25 words
      
      // Should not be collapsible in text mode (default threshold 30)
      const { rerender } = render(<CollapsibleMessage content={mediumContent} />);
      expect(screen.queryByText('Show More')).not.toBeInTheDocument();

      // Should still not be collapsible in voice mode (same threshold 30)
      setupVoiceModeMock(VoiceMode.VOICE_CONVERSATION);
      rerender(<CollapsibleMessage content={mediumContent} />);
      expect(screen.queryByText('Show More')).not.toBeInTheDocument();
      
      // But content above 30 words should be collapsible in both modes
      const longContent = Array(35).fill('word').join(' '); // 35 words
      rerender(<CollapsibleMessage content={longContent} />);
      expect(screen.getByText('Show More')).toBeInTheDocument();
    });

    it('applies voice mode CSS classes', () => {
      setupVoiceModeMock(VoiceMode.VOICE_CONVERSATION);
      const { container } = render(<CollapsibleMessage content={longContent} />);

      const messageElement = container.querySelector('.collapsible-message');
      expect(messageElement).toHaveClass('voice-mode');
    });

    it('does not show preview in voice mode when collapsed', () => {
      setupVoiceModeMock(VoiceMode.VOICE_CONVERSATION);
      const { container } = render(<CollapsibleMessage content={longContent} />);

      // Preview element should not be present (removed to fix UI clutter issue)
      const previewElement = container.querySelector('.collapsible-message__preview');
      expect(previewElement).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes on toggle button', () => {
      render(<CollapsibleMessage content={longContent} />);

      const toggleButton = screen.getByRole('button', { name: /show more/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      expect(toggleButton).toHaveAttribute('aria-label', 'Show more');

      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      expect(toggleButton).toHaveAttribute('aria-label', 'Show less');
    });

    it('has proper semantic structure', () => {
      render(<CollapsibleMessage content={longContent} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText(/40 words/)).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('applies correct state classes', () => {
      const { container } = render(
        <CollapsibleMessage content={longContent} className="custom-class" />
      );

      const messageElement = container.querySelector('.collapsible-message');
      expect(messageElement).toHaveClass('custom-class');
      expect(messageElement).toHaveClass('is-collapsible');
      expect(messageElement).toHaveClass('is-collapsed');
      expect(messageElement).not.toHaveClass('is-expanded');
    });

    it('applies expanded classes when expanded', () => {
      const { container } = render(
        <CollapsibleMessage 
          content={longContent} 
          expandedClassName="expanded-custom"
        />
      );

      fireEvent.click(screen.getByText('Show More'));

      const messageElement = container.querySelector('.collapsible-message');
      expect(messageElement).toHaveClass('is-expanded');
      expect(messageElement).toHaveClass('expanded-custom');
      expect(messageElement).not.toHaveClass('is-collapsed');
    });
  });

  describe('Reading time estimation', () => {
    it('shows reading time for longer content', () => {
      const veryLongContent = Array(500).fill('word').join(' '); // Should be > 1 min read
      
      render(<CollapsibleMessage content={veryLongContent} />);
      expect(screen.getByText(/min read/)).toBeInTheDocument();
    });

    it('does not show reading time for short content', () => {
      render(<CollapsibleMessage content={longContent} />);

      // 40 words should be less than 1 minute, so no reading time shown
      expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
    });
  });
}); 