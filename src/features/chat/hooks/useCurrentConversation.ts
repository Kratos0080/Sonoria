import { useState, useCallback } from 'react';
import { useChatContext } from '../../../core/context/ChatContext';
import { useConversations } from './useConversations';

/**
 * Hook for managing the current active conversation
 */
export function useCurrentConversation() {
  const { plugin } = useChatContext();
  const { activeConversation, saveConversation, addMessageToConversation } = useConversations();
  const [isLoading /*, setIsLoading */] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Function to send a message to the current conversation
  const sendMessage = useCallback(async (content: string) => {
    if (!activeConversation) {
      setError('No active conversation. Create a conversation first.');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // First add the user message
      await addMessageToConversation(activeConversation.id, content, 'user');
      
      // Then generate the AI response
      // @ts-expect-error // Known persistent issue - Investigate later (plugin possibly null)
      if (plugin.conversationManager) {
        // Use the plugin's conversation manager to send the message
        // @ts-expect-error // Known persistent issue - Investigate later (plugin possibly null)
        await plugin.conversationManager.sendMessage(content);
        
        // The response will be added to the conversation by the conversation manager
      } else {
        throw new Error('Conversation manager not initialized');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsGenerating(false);
    }
  }, [activeConversation, plugin, addMessageToConversation]);
  
  // Function to add a note to the current conversation
  const addNote = useCallback(async (noteId: string) => {
    if (!activeConversation) {
      setError('No active conversation');
      return;
    }
    
    // Check if note is already in conversation
    if (activeConversation.noteIds.includes(noteId)) {
      return; // Note already added
    }
    
    try {
      // If the conversation manager is available, use it
      // @ts-expect-error // Known persistent issue - Investigate later (plugin possibly null)
      if (plugin.conversationManager) {
        // @ts-expect-error // Known persistent issue - Investigate later (plugin possibly null)
        await plugin.conversationManager.addNote(noteId);
        return;
      }
      
      // Otherwise, update directly
      const updatedConversation = {
        ...activeConversation,
        noteIds: [...activeConversation.noteIds, noteId],
        updatedAt: Date.now()
      };
      
      await saveConversation(updatedConversation);
    } catch (err) {
      console.error('Error adding note to conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to add note');
    }
  }, [activeConversation, plugin, saveConversation]);
  
  // Function to remove a note from the current conversation
  const removeNote = useCallback(async (noteId: string) => {
    if (!activeConversation) {
      setError('No active conversation');
      return;
    }
    
    try {
      // If the conversation manager is available, use it
      // @ts-expect-error // Known persistent issue - Investigate later (plugin possibly null)
      if (plugin.conversationManager) {
        // @ts-expect-error // Known persistent issue - Investigate later (plugin possibly null)
        await plugin.conversationManager.removeNote(noteId);
        return;
      }
      
      // Otherwise, update directly
      const updatedConversation = {
        ...activeConversation,
        noteIds: activeConversation.noteIds.filter(id => id !== noteId),
        updatedAt: Date.now()
      };
      
      await saveConversation(updatedConversation);
    } catch (err) {
      console.error('Error removing note from conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove note');
    }
  }, [activeConversation, plugin, saveConversation]);
  
  // Function to update the title of the current conversation
  async function updateTitle(title: string) {
    if (!activeConversation) {
      setError('No active conversation');
      return;
    }
    
    try {
      const updatedConversation = {
        ...activeConversation,
        title,
        updatedAt: Date.now()
      };
      
      await saveConversation(updatedConversation);
    } catch (err) {
      console.error('Error updating conversation title:', err);
      setError(err instanceof Error ? err.message : 'Failed to update title');
    }
  }
  
  return {
    conversation: activeConversation,
    isLoading,
    isGenerating,
    error,
    sendMessage,
    addNote,
    removeNote,
    updateTitle
  };
} 