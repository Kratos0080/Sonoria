import React, { useState, useCallback, useMemo } from 'react';
import { sanitizeHtml } from '../../../utils/htmlUtils';
import { analyzeMessageContent, type CollapsibleMessageInfo } from '../../../utils/textUtils';
import { useVoiceModeCheck } from '../context/VoiceModeContext';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface CollapsibleMessageProps {
  content: string;
  className?: string;
  /** Override default word threshold (default: 30) */
  wordThreshold?: number;
  /** Override default truncate words (default: 25) */
  truncateWords?: number;
  /** Force collapse state regardless of content length */
  forceCollapsed?: boolean;
  /** Disable collapsible behavior entirely */
  disableCollapse?: boolean;
  /** Additional CSS classes for expanded/collapsed states */
  expandedClassName?: string;
  collapsedClassName?: string;
}

/**
 * CollapsibleMessage component handles automatic truncation and expansion of long messages
 * Uses consistent 30-word threshold across all interaction modes for standardized UX
 */
export const CollapsibleMessage: React.FC<CollapsibleMessageProps> = ({
  content,
  className = '',
  wordThreshold,
  truncateWords,
  forceCollapsed = false,
  disableCollapse = false,
  expandedClassName = '',
  collapsedClassName = ''
}) => {
  // Voice mode context for styling (keeping voice-mode styling differences)
  const { isVoiceConversationMode, isDictationMode } = useVoiceModeCheck();
  
  // Track whether user has manually interacted with this message
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  
  // Analyze message content with standardized defaults
  const messageAnalysis: CollapsibleMessageInfo = useMemo(() => {
    // Ensure we have content before analyzing
    if (!content || content.trim().length === 0) {
      return {
        shouldCollapse: false,
        wordCount: 0,
        estimatedReadingTime: 1,
        preview: '',
        truncatedContent: ''
      };
    }
    
    // Standardized thresholds across all modes for consistent UX
    const defaultWordThreshold = 30;
    const defaultTruncateWords = 25;
    
    const analysis = analyzeMessageContent(content, {
      wordThreshold: wordThreshold ?? defaultWordThreshold,
      truncateWords: truncateWords ?? defaultTruncateWords,
      previewLength: 120
    });
    
    // Debug: Log word count analysis for folding investigation
    console.log('🛑 DEBUG CollapsibleMessage analysis:', {
      messageId: content.substring(0, 30) + '...',
      wordCount: analysis.wordCount,
      threshold: wordThreshold ?? defaultWordThreshold,
      shouldCollapse: analysis.shouldCollapse,
      contentLength: content.length
    });
    
    return analysis;
  }, [content, wordThreshold, truncateWords]);

  // Determine if message should be collapsed
  const shouldCollapse = useMemo(() => {
    if (disableCollapse) return false;
    if (forceCollapsed) return true;
    return messageAnalysis.shouldCollapse;
  }, [disableCollapse, forceCollapsed, messageAnalysis.shouldCollapse]);

  // Initialize isExpanded based on shouldCollapse - start collapsed if should collapse
  const [isExpanded, setIsExpanded] = useState(() => !shouldCollapse);

  // Reset expansion state when shouldCollapse changes, forceCollapsed changes, or content changes
  // But only if user hasn't manually interacted with this message
  React.useEffect(() => {
    if (!userHasInteracted) {
      if (shouldCollapse) {
        // If message should be collapsed, ensure it starts collapsed
        setIsExpanded(false);
      } else {
        // If message should not be collapsed, ensure it starts expanded
        setIsExpanded(true);
      }
    }
  }, [shouldCollapse, forceCollapsed, messageAnalysis.shouldCollapse, content, userHasInteracted]);

  // Add specific handler for voice mode changes - but preserve user interactions
  React.useEffect(() => {
    // IMPORTANT: Only apply auto-folding logic if user hasn't manually interacted with this message
    if (!userHasInteracted) {
      if ((isVoiceConversationMode || isDictationMode) && shouldCollapse) {
        console.log('CollapsibleMessage: Auto-collapse for voice mode (no user interaction yet)');
        setIsExpanded(false);
      }
      // When switching away from voice mode, respect the natural shouldCollapse state
      else if (!(isVoiceConversationMode || isDictationMode)) {
        console.log('CollapsibleMessage: Reset to natural state (no user interaction yet)');
        setIsExpanded(!shouldCollapse);
      }
    } else {
      console.log('CollapsibleMessage: Preserving user interaction state during mode switch');
    }
  }, [isVoiceConversationMode, isDictationMode, shouldCollapse, userHasInteracted]);

  // Toggle expansion state
  const handleToggleExpansion = useCallback(() => {
    setIsExpanded(prev => !prev);
    setUserHasInteracted(true); // Mark that user has manually interacted with this message
  }, []);

  // Determine display content
  const displayContent = useMemo(() => {
    if (!shouldCollapse || isExpanded) {
      return content;
    }
    return messageAnalysis.truncatedContent;
  }, [shouldCollapse, isExpanded, content, messageAnalysis.truncatedContent]);

  // Generate CSS classes
  const messageClasses = useMemo(() => {
    const classes = ['collapsible-message'];
    
    if (className) classes.push(className);
    if (isVoiceConversationMode || isDictationMode) classes.push('voice-mode');
    if (shouldCollapse) classes.push('is-collapsible');
    if (isExpanded) classes.push('is-expanded');
    if (!isExpanded && shouldCollapse) classes.push('is-collapsed');
    
    // Add state-specific classes
    if (isExpanded && expandedClassName) classes.push(expandedClassName);
    if (!isExpanded && shouldCollapse && collapsedClassName) classes.push(collapsedClassName);
    
    return classes.join(' ');
  }, [className, isVoiceConversationMode, isDictationMode, shouldCollapse, isExpanded, expandedClassName, collapsedClassName]);

  return (
    <div className={messageClasses}>
      {/* Main message content */}
      <div 
        className="collapsible-message__content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
      />
      
      {/* Collapse/Expand controls */}
      {shouldCollapse && (
        <div className="collapsible-message__controls">
          <button
            className="collapsible-message__toggle"
            onClick={handleToggleExpansion}
            type="button"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Show less' : 'Show more'}
          >
            <span className="toggle-text">
              {isExpanded ? 'Show Less' : 'Show More'}
            </span>
            <span className="toggle-icon" aria-hidden="true">
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          </button>
          
          {/* Message metadata (word count, reading time) */}
          <div className="collapsible-message__metadata">
            <span className="word-count">
              {messageAnalysis.wordCount} words
            </span>
            {messageAnalysis.estimatedReadingTime > 1 && (
              <span className="reading-time">
                · {messageAnalysis.estimatedReadingTime} min read
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Hook for using collapsible message analysis without rendering
 * Useful for other components that need to determine if content should be collapsible
 */
export const useCollapsibleMessageAnalysis = (
  content: string,
  options?: {
    wordThreshold?: number;
    truncateWords?: number;
  }
): CollapsibleMessageInfo => {
  return useMemo(() => {
    // Standardized thresholds across all modes for consistent UX
    const defaultWordThreshold = 30;
    const defaultTruncateWords = 25;
    
    return analyzeMessageContent(content, {
      wordThreshold: options?.wordThreshold ?? defaultWordThreshold,
      truncateWords: options?.truncateWords ?? defaultTruncateWords,
      previewLength: 120
    });
  }, [content, options?.wordThreshold, options?.truncateWords]);
}; 