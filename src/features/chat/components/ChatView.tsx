import React, { useState, useEffect, useRef } from 'react';
import { TFile, Notice } from 'obsidian';
import { observer } from 'mobx-react-lite';
import { useChatContext } from '../../../core/context/ChatContext';
import { useConversation } from '../hooks/useConversation';
import { useNotes } from '../hooks/useNotes';
import ChatHeader from './ChatHeader';
import ContextArea from './ContextArea';
import ChatMessageArea from './ChatMessageArea';
import { ChatInputArea } from './ChatInputArea';

import { VoiceModeProvider } from '../context/VoiceModeContext';
import type { NoteChatPlugin } from '@app/core/types/obsidian';
import type { SuggestedPrompt } from './ChatInputArea';

/** Props for the ChatView component */
interface ChatViewProps {
  /** Optional callback function to execute when the view is closed. */
  onClose?: () => void;
  plugin: NoteChatPlugin;
}

/**
 * Main chat view component that orchestrates the chat UI.
 * Serves as a container component that composes child components 
 * and facilitates communication between them.
 */
export const ChatView: React.FC<ChatViewProps> = ({ onClose, plugin: initialPlugin }) => {
  // Static list of suggested prompts
  const suggestedPrompts: SuggestedPrompt[] = [
    { title: 'Summarize Note', text: 'Please summarize the content of this note.' },
    { title: 'Key Takeaways', text: 'What are the key takeaways from this note?' },
    { title: 'Ask a Question', text: 'What questions can I ask about this note?' },
  ];
  // Restore original context hook usage
  const { 
    app,
  } = useChatContext();
  
  // Restore separate conversation hook usage
  const conversation = useConversation();
  
  // Extract needed values from the conversation object returned by useConversation
  const { 
    isLoading: isSending, 
  } = conversation; // Assuming useConversation returns an object with these
  
  // Voice mode is now managed by VoiceModeContext
  
  // Access noteService directly from the typed plugin instance
  const noteService = initialPlugin.noteService;
  
  // NEW State for input value
  const [inputValue, setInputValue] = useState('');
  
  // Flag to prevent duplicate note inclusion
  const isProcessingFileChange = useRef(false);
  const initialLoadComplete = useRef(false);
  
  // NEW State for main context folding
  const [isContextAreaFolded, setIsContextAreaFolded] = useState(false);
  const toggleContextAreaFold = () => setIsContextAreaFolded((prev: boolean) => !prev);
  
  // RENAMED State: Boolean signal to force close popups
  const [forceCloseSignal, setForceCloseSignal] = useState(false);
  
  // State for tracking recycle operation loading
  const [isRecycling, setIsRecycling] = useState(false);
  
  // Notes handling with our custom hook
  const { 
    activeNotes, 
    loadingNotes,
    addNote,
    removeNote,
    refreshNotes
  } = useNotes();
  
  // Get current file for context area
  const getCurrentFile = (): TFile | null => {
    return noteService.getActiveFile();
  };
  
  // Suggested prompts for the input area
  // const [status, setStatus] = useState<string>(''); // REMOVED: Unused state
  // const [error, setError] = useState<string | null>(null); // Commented out unused state
  // Use NoteChatPlugin type for plugin state
  // const [plugin, setPlugin] = useState<NoteChatPlugin | null>(null); // Commented out unused state
  
  // --- Define handlers BEFORE useEffect --- 

  /**
   * Handles adding the currently active file to the conversation context.
   * Triggered by the 'Add Current Note' button in ContextArea.
   */
  const handleAddCurrentNote = async () => {
    console.log("Add Current Note button clicked...");
    const currentFile = getCurrentFile();
    if (!currentFile) {
      new Notice('No file is currently active to add.');
      return;
    }
    try {
      await addNote(currentFile.path);
    } catch (error: unknown) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.error("Error adding current note via handleAddCurrentNote:", errorMessage);
      new Notice(`Error adding current note: ${errorMessage}`);
    }
  }; 
  
  // NEW: Handler for adding a specific note (from Recent/Search lists - by PATH)
  /**
   * Handles adding a note to the conversation context using a TFile object.
   * Currently wraps handleAddNoteByPath. Potentially useful if direct TFile needed later.
   * @param file The TFile object to add.
   */
  const handleAddNoteByFile = async (file: TFile) => {
    console.log(`Adding note TFile: ${file.path}`);
    if (!file) return;
       try {
      await addNote(file.path);
       } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error adding note TFile ${file.path} via handleAddNoteByFile:`, errorMessage);
          new Notice(`Error adding note: ${errorMessage}`);
       }
  };

  // Effect for INITIAL load
  useEffect(() => {
    if (initialLoadComplete.current) return;
    initialLoadComplete.current = true;
    
    console.log("ChatView useEffect: Initial setup");
    
    // Trigger initial notes refresh
    refreshNotes();
    console.log("Initial notes refresh triggered");
  }, [refreshNotes]);
  
  /** 
   * Handles removing a note from the conversation context.
   * @param notePath The vault path of the note to remove.
   */
  const handleRemoveNote = async (notePath: string) => {
    console.log(`Attempting to remove note: ${notePath}`);
    if (isProcessingFileChange.current) {
      console.log("Skipping remove, processing another change.");
      return;
    }

    try {
      isProcessingFileChange.current = true;
      
      const file = app.vault.getAbstractFileByPath(notePath);
      if (!(file instanceof TFile)) {
        console.error("Note not found for removal:", notePath);
        isProcessingFileChange.current = false; 
        return; 
      }
      
      console.log("Removing note from conversation in ChatView:", file.basename);
      
      // Call removeFile from useNotes (which handles the notice)
      await removeNote(notePath); 
      
      console.log("Note removal successful call made from ChatView for:", file.basename);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error removing note ${notePath}:`, errorMessage, error);
      new Notice(`Failed to remove note: ${errorMessage}`);
    } finally {
      setTimeout(() => {
        isProcessingFileChange.current = false;
        console.log("isProcessingFileChange flag reset after removal attempt.");
      }, 100); 
    }
  };
  
  /**
   * Handles sending the current input value as a new message.
   * Also handles sending suggested prompts via optional messageOverride.
   * @param messageOverride Optional message text to send instead of current input.
   */
  const handleSendMessage = (messageOverride?: string) => { // Type parameter strictly string | undefined
    const textToSend = messageOverride ?? inputValue;
    if (!textToSend.trim()) return;

    console.log(`Sending message: ${textToSend}`);

    // Use conversation.sendMessage
    conversation.sendMessage(textToSend);

    setInputValue(''); // Clear input after sending
    setForceCloseSignal(prev => !prev); // Close popups after sending
  };
  
  /**
   * Handles clearing both messages and context notes by ending the conversation properly.
   */
  const handleRecycle = async () => {
    console.log("Recycle action triggered");
    if (!initialPlugin || !initialPlugin.conversationManager) {
        console.error("Cannot recycle: ConversationManager not available.");
        new Notice("Error: Could not recycle conversation.");
        return;
    }
    
    // Set loading state immediately for visual feedback
    setIsRecycling(true);
    
    try {
      // FIXED: Directly clear the active notes UI state for immediate visual feedback
      refreshNotes();
      
      // FIXED: Call the correct endConversation method on the ConversationManager instance
      setForceCloseSignal(prev => !prev); // Toggle boolean signal for UI consistency
      await conversation.recycleContext();
      setInputValue('');
      
      new Notice("Context cleared and conversation reset.");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error recycling context:", errorMessage, error);
      new Notice(`Error recycling context: ${errorMessage}`);
    } finally {
      // Clear loading state
      setIsRecycling(false);
    }
  };
  
  /**
   * Handles initiating the save conversation process.
   */
  const handleSaveConversation = async (event?: React.MouseEvent) => {
    event?.preventDefault();
    if (!initialPlugin || !initialPlugin.conversationManager) return;
    try {
      await initialPlugin.conversationManager.saveCurrentConversationToNote();
      new Notice('Conversation saved successfully.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error saving conversation:", errorMessage, error);
      new Notice(`Error saving conversation: ${errorMessage}`);
    }
  };

  // Handler for suggested prompt selection
  /**
   * Handle user selecting a suggested prompt
   */
  const handleSelectSuggestedPrompt = (promptText: string) => {
    console.log('Selected suggested prompt:', promptText);
    handleSendMessage(promptText);
  };

  // 🛑 STOP GENERATION: Handler for stopping AI generation
  const handleStopGeneration = () => {
    console.log('Stop generation requested');
    conversation.stopGeneration();
  };

  // 🛑 STOP GENERATION: Check if generation can be stopped
  const canStopGeneration = conversation.canStopGeneration;


  // --- RENDER ---
  return (
    <VoiceModeProvider>
      <div className="notechat-view">
        <ChatHeader 
          noteCount={activeNotes.length}
          isContextAreaFolded={isContextAreaFolded}
          onToggleContextAreaFold={toggleContextAreaFold}
          onClose={onClose} 
          onRecycle={handleRecycle} 
          onSaveConversation={handleSaveConversation}
          isRecycling={isRecycling}
        />
        {/* Context Area: Shows selected notes and context management tabs */}
        {!isContextAreaFolded && (
          <ContextArea 
            activeNotes={activeNotes} 
            onAddCurrentNote={handleAddCurrentNote}
            onAddNote={handleAddNoteByFile}
            onRemoveNote={handleRemoveNote}
            forceCloseSignal={forceCloseSignal}
            currentFile={getCurrentFile()}
            loadingNotes={loadingNotes}
          />
        )}
        <ChatMessageArea
          messages={conversation.messages}
          isLoading={conversation.isLoading}
          loadingMessage={conversation.loadingMessage}
          streamingMessage={conversation.streamingMessage}
          isStreaming={conversation.isStreaming}
        />
        <ChatInputArea
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          className="chat-view-input-area"
          onSelectPrompt={handleSelectSuggestedPrompt}
          prompts={suggestedPrompts}
          forceCloseSignal={forceCloseSignal}
          isSending={isSending}
          isGenerating={canStopGeneration}
          onStopGeneration={handleStopGeneration}
        />
      </div>
    </VoiceModeProvider>
  );
}

export default observer(ChatView); 