import { useState, useEffect, useCallback, useMemo } from 'react';
import { useChatContext } from '../../../core/context/ChatContext';
import { TFile, Notice } from 'obsidian';
import type { /* Conversation, */ Message } from '../../../core/types/conversation';
// REMOVED: Unused import
// import type { NoteChatPlugin } from '@app/core/types/obsidian'; 
// Keep this import removed
// import { ConversationManager } from '../store/conversationContext';

// Define the props for the hook - REMOVED as unused
// interface UseConversationProps {
//   plugin: NoteChatPlugin; // Use NoteChatPlugin type instead of any
// }

/**
 * Custom hook for managing conversations
 * Provides methods and state for interacting with conversations
 */
export function useConversation() {
  const { app, plugin } = useChatContext();
  // @ts-expect-error // Known persistent issue - Investigate later (plugin possibly null)
  const conversationManager = plugin.conversationManager;
  // Use optional chaining as plugin can be null
  const noteService = plugin?.noteService; 

  const [activeFile, setActiveFile] = useState<TFile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  // Get current state directly from manager (handle nullability)
  const messages = useMemo(() => {
    return conversationManager?.currentConversation?.messages || [];
  }, [conversationManager?.currentConversation?.messages]);
  
  // Direct access to streaming state - observer will handle reactivity
  const streamingMessage = conversationManager?.streamingMessage || null;
  const isStreaming = conversationManager?.isStreaming || false;
  
  const currentConversationId = conversationManager?.currentConversation?.id || null;
  const includedNoteIds = conversationManager?.currentConversation?.noteIds || [];

  // Initialize activeFile state (keep this logic)
  useEffect(() => {
    const currentFile = app.workspace.getActiveFile();
    if (currentFile) {
      setActiveFile(currentFile);
    }
    const handleActiveFileChanged = () => {
      const file = app.workspace.getActiveFile();
      if (file) {
        setActiveFile(file);
      }
    };
    app.workspace.on('active-leaf-change', handleActiveFileChanged);
    return () => {
      app.workspace.off('active-leaf-change', handleActiveFileChanged);
    };
  }, [app]);

  // --- Define functions before they are used as dependencies --- 

  /**
   * Save message content as a new note
   */
  const saveMessageAsNote = useCallback(async (message: Message) => {
    if (!app) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Creating note...');
      const firstLine = message.content.split('\n')[0].trim();
      const title = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-').trim();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `${safeTitle} ${timestamp}.md`;
      await app.vault.create(filename, message.content);
      new Notice('Note created successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error saving message as note:', errorMessage);
      setLoadingMessage(`Error: ${errorMessage}`);
      new Notice(`Error saving note: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [app]);

  /**
   * Regenerate the AI response for a message
   */
  const regenerateResponse = useCallback(async (messageId: string) => {
    if (!conversationManager?.currentConversation || !messages) {
        console.error('Conversation manager or current conversation not available for regeneration.');
        setIsLoading(false);
        setLoadingMessage('Error: Could not regenerate response.');
        return;
    }
    try {
      setIsLoading(true);
      setLoadingMessage('Regenerating response...');
      const currentMessages = conversationManager.currentConversation?.messages || []; // Use current messages from manager
      const messageIndex = currentMessages.findIndex((msg: Message) => msg.id === messageId);
      if (messageIndex <= 0) {
        console.error('Error regenerating response: Could not find preceding user message for ID:', messageId);
        setLoadingMessage('Error: Could not regenerate response.');
        return;
      }
      let userMessageIndex = messageIndex - 1;
      while (userMessageIndex >= 0 && currentMessages[userMessageIndex].role !== 'user') {
        userMessageIndex--;
      }
      if (userMessageIndex < 0) {
        console.error('Error regenerating response: No preceding user message found for ID:', messageId);
        setLoadingMessage('Error: Could not regenerate response.');
        return;
      }
      const userMessage = currentMessages[userMessageIndex];
      await conversationManager.sendMessage(userMessage.content);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error regenerating response:', errorMessage);
      setLoadingMessage(`Error: ${errorMessage}`);
    } finally { 
      setIsLoading(false);
    }
  }, [conversationManager, messages]); // Added messages to dependencies

  // --- Add Save Conversation Function --- 
  const saveConversation = useCallback(async () => {
    if (!conversationManager) {
      new Notice('Conversation Manager not available.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Saving conversation...');
    try {
      // Call the manager method - it should handle its own notices
      await conversationManager.saveCurrentConversationToNote();
      // No success notice needed here
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error saving conversation via hook:', errorMessage);
      new Notice(`Error saving conversation: ${errorMessage}`);
      setLoadingMessage(`Error: ${errorMessage}`); // Keep error message
    } finally {
      // Always clear loading state after attempt
      setIsLoading(false);
      // Clear loading message only if it wasn't an error message from the catch block
      if (!loadingMessage?.startsWith('Error:')) { 
        setLoadingMessage(null);
      }
    }
  }, [conversationManager, loadingMessage]); // Keep loadingMessage dependency for the finally block logic

  // --- Other Callbacks --- 

  /**
   * Start a new conversation with the selected notes
   */
  const startNewConversation = useCallback(async (initialMessage?: string) => {
    if (!conversationManager || !noteService) {
      new Notice('Conversation Manager or Note Service not available.');
      return;
    }
    const currentIncludedNoteIds = conversationManager.currentConversation?.noteIds || []; // Get current IDs
    if (!activeFile && currentIncludedNoteIds.length === 0) {
      setLoadingMessage('No notes selected for conversation');
      new Notice('Select notes or ensure a file is active to start a chat.'); 
      return;
    }
    try {
      setIsLoading(true);
      setLoadingMessage('Starting conversation...');
      let notesToUse = [...currentIncludedNoteIds];
      if (notesToUse.length === 0 && activeFile) {
        notesToUse = [activeFile.path];
      }
      const primaryNoteId = activeFile && notesToUse.includes(activeFile.path)
        ? activeFile.path
        : notesToUse[0];
      const additionalNoteIds = notesToUse.filter(id => id !== primaryNoteId);
      const primaryNote = app.vault.getAbstractFileByPath(primaryNoteId);
      let primaryContent = '';
      if (primaryNote instanceof TFile) {
        primaryContent = await noteService.getFileContent(primaryNote); // Use noteService variable
      }
      await conversationManager.startConversation(primaryNoteId, primaryContent, additionalNoteIds);
      if (initialMessage) {
        await conversationManager.sendMessage(initialMessage);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error starting conversation:', errorMessage);
      setLoadingMessage(`Error: ${errorMessage}`);
      new Notice(`Error starting conversation: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [conversationManager, noteService, app.vault, activeFile]); // Updated dependencies
  
  /**
   * Send a message in the current conversation or start a new one
   */
  const sendMessage = useCallback(async (text: string) => {
    if (!conversationManager) return;
    try {
      const currentConvoId = conversationManager.currentConversation?.id; // Get current ID
      if (!currentConvoId) {
        await startNewConversation(text);
        return;
      }
      // DON'T set hook loading state - let ConversationManager handle isLoading for AI generation
      await conversationManager.sendMessage(text);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error sending message:', errorMessage);
      setLoadingMessage(`Error: ${errorMessage}`);
      new Notice(`Error sending message: ${errorMessage}`);
    }
  }, [conversationManager, startNewConversation]); // Updated dependencies
  
  /**
   * Add or remove a note from the conversation
   * TODO: Implement actual include/exclude logic if needed here or confirm manager handles it
   */
  const toggleNote = useCallback((/* notePath: string */) => {
    // This logic seems to be related to the old ConversationManager
    // const currentIncludedNoteIds = conversationManager.currentConversation?.noteIds || []; 
    // TODO: Re-implement note toggling based on the current architecture (e.g., ChatContext or NoteService)
    console.warn("toggleNote functionality is not implemented yet.");
  }, [/* conversationManager - remove dependency */]);
  
  /**
   * End the current conversation
   */
  const endConversation = useCallback(() => {
    if (!conversationManager) return;
    conversationManager.endConversation();
  }, [conversationManager]);

  /**
   * Handles actions triggered from ChatMessage component (e.g., save, regenerate)
   */
  const handleMessageAction = useCallback((action: string, messageId: string) => {
    // Add null check for currentConversation
    if (!conversationManager?.currentConversation) {
        console.error('Cannot handle message action: No current conversation.');
        new Notice('Error: No active conversation for action.');
        return;
    }
    const message = conversationManager.currentConversation.messages.find((msg: Message) => msg.id === messageId);
    if (!message) {
      console.error(`Message with ID ${messageId} not found for action ${action}.`);
      new Notice('Error: Could not find message for action.');
      return;
    }

    switch (action) {
      case 'save-as-note':
        saveMessageAsNote(message);
        break;
      case 'regenerate':
        regenerateResponse(messageId);
        break;
      // Add other actions as needed
      default:
        console.warn(`Unhandled message action: ${action}`);
    }
    // Dependencies are the functions it calls
  }, [conversationManager, saveMessageAsNote, regenerateResponse]); 
  
  // --- NEW: Recycle Context Function ---
  const recycleContext = useCallback(async () => {
    if (!conversationManager) {
      new Notice('Conversation Manager not available.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Resetting conversation...');
    try {
      // Call the endConversation method which now handles clearing context and starting fresh
      await conversationManager.endConversation(); 
      // No success notice here as manager should provide it or ChatView will
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error resetting conversation via hook:', errorMessage);
      // Fallback notice
      new Notice(`Error resetting conversation: ${errorMessage}`);
      setLoadingMessage(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      if (!loadingMessage?.startsWith('Error:')) { 
        setLoadingMessage(null);
      }
    }
  }, [conversationManager, loadingMessage]);

  // 🛑 STOP GENERATION: Stop ongoing AI generation
  const stopGeneration = useCallback(() => {
    if (!conversationManager) {
      console.warn('Conversation Manager not available for stopping generation.');
      return;
    }
    conversationManager.stopGeneration();
  }, [conversationManager]);

  // 🛑 STOP GENERATION: Check if generation can be stopped
  // Access observable properties directly for MobX reactivity
  const isProcessing = conversationManager?.['isProcessing'] ?? false;
  const hasAbortController = conversationManager?.['currentAbortController'] !== null;
  
  const canStopGeneration = useMemo(() => {
    const result = hasAbortController && isProcessing;
    return result;
  }, [conversationManager, hasAbortController, isProcessing]);

  // Use manager's isLoading for AI generation, hook's isLoading for other operations
  const managerIsLoading = conversationManager?.['isLoading'] ?? false;
  const combinedIsLoading = managerIsLoading || isLoading;
  

  
  return {
    // State (read directly from manager or local state)
    messages,
    isLoading: combinedIsLoading, // Use combined loading state
    loadingMessage,
    activeFile,
    includedNoteIds,
    currentConversationId,
    streamingMessage,
    isStreaming,
    
    // Methods
    sendMessage,
    startNewConversation,
    endConversation,
    toggleNote,
    handleMessageAction,
    saveMessageAsNote, 
    regenerateResponse,
    saveConversation,
    recycleContext,
    // 🛑 STOP GENERATION: Stop generation methods
    stopGeneration,
    canStopGeneration
  };
} 