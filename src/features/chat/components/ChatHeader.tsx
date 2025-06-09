// import React from 'react'; // Removed unused import
// import { useState } from 'react';
import type { ChatHeaderProps } from '../../../core/types/components';
// import { useChatContext } from '../../../core/context/ChatContext'; // Might not be needed if endConversation is handled by prop
import HeaderActions from './HeaderActions';
import { ChevronDown, ChevronUp } from 'lucide-react'; // Assuming we have lucide-react for icons
// import { useNotes } from '../hooks/useNotes'; // Remove useNotes import

// Extend props to include the recycle handler and signal setter from parent
interface ExtendedChatHeaderProps extends ChatHeaderProps {
  onRecycle: () => Promise<void>; // Handler passed from ChatView
  onSaveConversation: () => Promise<void>; // Add the save handler prop
  // onClose is now optional from ChatHeaderProps
  // New props for context folding
  noteCount: number;
  isContextAreaFolded: boolean;
  onToggleContextAreaFold: () => void;
  isRecycling?: boolean; // Loading state for recycle button
}

/**
 * Header component for the chat interface with title and controls
 */
export function ChatHeader({
  // title = 'NoteChat', // Default title, will be overridden - REMOVE THIS LINE
  onRecycle, // Receive the handler from props
  onSaveConversation, // Receive the save handler prop
  // New props
  noteCount,
  isContextAreaFolded,
  onToggleContextAreaFold,
  isRecycling = false,
}: ExtendedChatHeaderProps) {
  // const { endConversation } = useChatContext(); // Context might not be needed directly here
  // const { setActiveNotes } = useNotes(); // Remove direct hook usage
  
  /**
   * Handle recycle/clear context button click
   * Calls the handler passed from the parent (ChatView)
   */
  const handleRecycleContext = async () => {
    await onRecycle(); // Then call the parent handler
  };

      const dynamicTitle = `Sonoria: Context (${noteCount} Note${noteCount === 1 ? '' : 's'})`;

  return (
    <div className="notechat-header">
      <div className="notechat-header-left">
        <h2 className="notechat-title">{dynamicTitle}</h2>
        <button 
          onClick={onToggleContextAreaFold} 
          className="notechat-header__fold-button" 
          aria-label={isContextAreaFolded ? 'Unfold Context Area' : 'Fold Context Area'}
        >
          {isContextAreaFolded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>
      <div className="notechat-header-right">
        {/* Context counter removed as it's part of the main title now */}
        {/* <span className="notechat-context-counter">
          Context ({includedNoteCount} {includedNoteCount === 1 ? 'Note' : 'Notes'})
        </span> */}
        <HeaderActions
          onSaveConversation={onSaveConversation}
          onRecycleContext={handleRecycleContext}
          isRecycling={isRecycling}
          // Removed onClose prop as HeaderActions doesn't expect it
        />
      </div>
    </div>
  );
}

export default ChatHeader; 