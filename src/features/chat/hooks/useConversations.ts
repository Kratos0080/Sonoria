import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message } from '../../../core/types/conversation';
import { useChatContext } from '../../../core/context/ChatContext';

export interface UseConversationsResult {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  setActiveConversation: (id: string) => void;
  createConversation: (noteIds?: string[]) => Conversation;
  saveConversation: (conversation: Conversation) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addMessageToConversation: (conversationId: string, content: string, role: 'user' | 'assistant') => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing conversations in the NoteChat plugin
 */
export function useConversations(): UseConversationsResult {
  const { plugin } = useChatContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
  
  // Load all saved conversations from storage (moved before useEffect)
  const loadConversations = useCallback(async () => {
    if (!plugin) return [];
    try {
      const data = await plugin.loadData();
      const loadedConversations = data?.conversations || [];
      console.log('Loaded conversations:', loadedConversations);
      setConversations(loadedConversations);
      return loadedConversations;
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [plugin]);
  
  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);
  
  // Set the active conversation by ID
  const setActiveConversation = (id: string) => {
    setActiveConversationId(id);
  };
  
  // Create a new conversation
  const createConversation = (noteIds: string[] = []): Conversation => {
    const isoNow = new Date().toISOString();
    const newConversation: Conversation = {
      id: uuidv4(),
      noteIds: noteIds,
      title: 'New Conversation',
      creationDate: isoNow,
      lastModified: isoNow,
      messages: [],
      isArchived: false,
      previous_response_id: null,
      vectorStoreId: null,
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    
    return newConversation;
  };
  
  // Save a conversation to storage
  const saveConversation = useCallback(async (conversation: Conversation): Promise<void> => {
    if (!plugin) return;
    try {
      // Update timestamp
      conversation.lastModified = new Date().toISOString();
      
      // Save to storage
      const data = await plugin.loadData() || {};
      const updatedConversations = (data.conversations || []).map(
        (c: Conversation) => c.id === conversation.id ? conversation : c
      );
      
      // If conversation doesn't exist yet, add it
      if (!updatedConversations.some((c: Conversation) => c.id === conversation.id)) {
        updatedConversations.push(conversation);
      }
      
      // Save back to plugin data
      const updatedData = { ...data, conversations: updatedConversations };
      await plugin.saveData(updatedData);
      
      // Update local state
      setConversations(prev => 
        prev.map(c => c.id === conversation.id ? conversation : c)
      );
    } catch (err) {
      console.error('Error saving conversation:', err);
      setError('Failed to save conversation');
      throw err;
    }
  }, [plugin]);
  
  // Delete a conversation
  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    if (!plugin) return;
    try {
      // Remove from storage
      const data = await plugin.loadData() || {};
      const updatedConversations = (data.conversations || []).filter(
        (c: Conversation) => c.id !== id
      );
      
      // Save back to plugin data
      const updatedData = { ...data, conversations: updatedConversations };
      await plugin.saveData(updatedData);
      
      // Update local state
      setConversations(prev => prev.filter(c => c.id !== id));
      
      // If the active conversation was deleted, select another one
      if (activeConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
      setError('Failed to delete conversation');
      throw err;
    }
  }, [plugin, activeConversationId, conversations]);
  
  // Add a message to a conversation
  const addMessageToConversation = useCallback(async (
    conversationId: string, 
    content: string, 
    role: 'user' | 'assistant'
  ): Promise<void> => {
    if (!plugin) throw new Error('Plugin is not initialized');
    try {
      const conversation = conversations.find(c => c.id === conversationId);
      
      if (!conversation) {
        throw new Error(`Conversation with ID ${conversationId} not found`);
      }
      
      const newMessage: Message = {
        id: uuidv4(),
        conversationId,
        content,
        role,
        timestamp: Date.now()
      };
      
      const updatedConversation = {
        ...conversation,
        messages: [...conversation.messages, newMessage],
        lastModified: new Date().toISOString(),
      };
      
      await saveConversation(updatedConversation);
    } catch (err) {
      console.error('Error adding message to conversation:', err);
      setError('Failed to add message to conversation');
      throw err;
    }
  }, [plugin, conversations, saveConversation]);
  
  return {
    conversations,
    activeConversation,
    setActiveConversation,
    createConversation,
    saveConversation,
    deleteConversation,
    addMessageToConversation,
    isLoading,
    error
  };
} 