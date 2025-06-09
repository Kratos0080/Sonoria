import { nanoid } from 'nanoid';
import type NoteChatPlugin from '@app/main';
import type { Conversation, ConversationNote, Message } from '../types/conversation';

/**
 * Service for managing conversation storage
 */
export class StorageService {
  private plugin: NoteChatPlugin;
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private notes: Map<string, ConversationNote> = new Map();

  /**
   * Create a new storage service
   * @param plugin - The NoteChat plugin instance
   */
  constructor(plugin: NoteChatPlugin) {
    this.plugin = plugin;
    this.loadData();
  }

  /**
   * Load conversation data from storage
   */
  private async loadData(): Promise<void> {
    try {
      // Add safety check for plugin settings
      if (!this.plugin?.settings) {
        console.log('StorageService: Plugin settings not available yet, skipping load');
        return;
      }

      const data = await this.plugin.loadData();
      
      if (data?.conversations) {
        const conversations = JSON.parse(data.conversations);
        conversations.forEach((conversation: Conversation) => {
          this.conversations.set(conversation.id, conversation);
        });
      }
      
      if (data?.messages) {
        const messages = JSON.parse(data.messages);
        Object.entries(messages).forEach(([conversationId, msgs]) => {
          this.messages.set(conversationId, msgs as Message[]);
        });
      }
      
      if (data?.notes) {
        const notes = JSON.parse(data.notes);
        notes.forEach((note: ConversationNote) => {
          this.notes.set(note.id, note);
        });
      }
    } catch (error) {
      console.error('Failed to load conversation data:', error);
    }
  }

  /**
   * Save conversation data to storage
   */
  private async saveData(): Promise<void> {
    try {
      // Add safety check for plugin settings
      if (!this.plugin?.settings) {
        console.log('StorageService: Plugin settings not available yet, skipping save');
        return;
      }

      const data = {
        conversations: JSON.stringify(Array.from(this.conversations.values())),
        messages: JSON.stringify(Object.fromEntries(this.messages)),
        notes: JSON.stringify(Array.from(this.notes.values()))
      };
      
      await this.plugin.saveData(data);
    } catch (error) {
      console.error('Failed to save conversation data:', error);
    }
  }

  /**
   * Create a new conversation
   * @param noteId - ID of the note the conversation is about
   * @param title - Title of the conversation
   * @param summary - Optional summary of the note
   * @returns The created conversation
   */
  public async createConversation(
    noteId: string,
    title: string,
    summary?: string
  ): Promise<Conversation> {
    const id = nanoid();
    const now = Date.now();
    const isoNow = new Date(now).toISOString();
    
    const conversation: Conversation = {
      id,
      noteIds: [noteId],
      primaryNoteId: noteId,
      title,
      creationDate: isoNow,
      lastModified: isoNow,
      messages: [],
      summary,
      isArchived: false,
      previous_response_id: null,
      vectorStoreId: null,
    };
    
    this.conversations.set(id, conversation);
    this.messages.set(id, []);
    await this.saveData();
    
    return conversation;
  }

  /**
   * Create a new conversation with multiple notes
   * @param noteIds - Array of note IDs to include in the conversation
   * @param primaryNoteId - ID of the primary note the conversation is centered on
   * @param title - Title of the conversation
   * @param summary - Optional summary of the notes
   * @param contextNotes - Optional metadata about the context notes
   * @returns The created conversation
   */
  public async createMultiNoteConversation(
    noteIds: string[],
    primaryNoteId: string,
    title: string,
    summary?: string,
    contextNotes?: {[noteId: string]: {title: string; summary?: string; included: boolean}}
  ): Promise<Conversation> {
    const id = nanoid();
    const now = Date.now();
    const isoNow = new Date(now).toISOString();
    
    const conversation: Conversation = {
      id,
      noteIds,
      primaryNoteId,
      title,
      creationDate: isoNow,
      lastModified: isoNow,
      messages: [],
      summary,
      isArchived: false,
      contextNotes,
      previous_response_id: null,
      vectorStoreId: null,
    };
    
    this.conversations.set(id, conversation);
    this.messages.set(id, []);
    await this.saveData();
    
    return conversation;
  }

  /**
   * Get a conversation by ID
   * @param id - ID of the conversation to get
   * @returns The conversation, or undefined if not found
   */
  public getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get all conversations
   * @param noteId - Optional note ID to filter by
   * @returns Array of conversations
   */
  public getConversations(noteId?: string): Conversation[] {
    const conversations = Array.from(this.conversations.values());
    
    if (noteId) {
      return conversations.filter(c => c.noteIds.includes(noteId));
    }
    
    return conversations;
  }

  /**
   * Update a conversation
   * @param conversation - The conversation to update
   * @returns The updated conversation
   */
  public async updateConversation(conversation: Conversation): Promise<Conversation> {
    conversation.lastModified = new Date().toISOString();
    this.conversations.set(conversation.id, conversation);
    await this.saveData();
    
    return conversation;
  }

  /**
   * Delete a conversation
   * @param id - ID of the conversation to delete
   * @returns True if the conversation was deleted, false otherwise
   */
  public async deleteConversation(id: string): Promise<boolean> {
    const deleted = this.conversations.delete(id);
    this.messages.delete(id);
    
    if (deleted) {
      await this.saveData();
    }
    
    return deleted;
  }

  /**
   * Add a message to a conversation
   * @param conversationId - ID of the conversation to add the message to
   * @param content - Content of the message
   * @param role - Role of the message sender
   * @returns The created message
   */
  public async addMessage(
    conversationId: string,
    content: string,
    role: 'user' | 'assistant'
  ): Promise<Message> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }
    
    const id = nanoid();
    const message: Message = {
      id,
      conversationId,
      content,
      role,
      timestamp: Date.now(),
      isHighlighted: false
    };
    
    const messages = this.messages.get(conversationId) || [];
    messages.push(message);
    this.messages.set(conversationId, messages);
    
    // Update conversation
    conversation.lastModified = new Date().toISOString();
    conversation.messages = messages;
    this.conversations.set(conversationId, conversation);
    
    await this.saveData();
    
    return message;
  }

  /**
   * Get messages for a conversation
   * @param conversationId - ID of the conversation to get messages for
   * @returns Array of messages
   */
  public getMessages(conversationId: string): Message[] {
    return this.messages.get(conversationId) || [];
  }

  /**
   * Create a note from a conversation
   * @param conversationId - ID of the conversation to create a note from
   * @param title - Title of the note
   * @param content - Content of the note
   * @param originalNoteId - ID of the original note
   * @returns The created note
   */
  public async createNote(
    conversationId: string,
    title: string,
    content: string,
    originalNoteId: string
  ): Promise<ConversationNote> {
    const id = nanoid();
    const noteId = nanoid(); // This will be replaced with the actual note ID after creation
    
    const note: ConversationNote = {
      id,
      conversationId,
      noteId,
      title,
      content,
      createdAt: Date.now(),
      metadata: {
        source: 'conversation',
        originalNoteId
      }
    };
    
    this.notes.set(id, note);
    await this.saveData();
    
    return note;
  }

  /**
   * Update a note's ID after creation in Obsidian
   * @param noteId - ID of the note to update
   * @param obsidianNoteId - Obsidian note ID
   * @returns The updated note
   */
  public async updateNoteId(noteId: string, obsidianNoteId: string): Promise<ConversationNote | undefined> {
    const note = Array.from(this.notes.values()).find(n => n.id === noteId);
    
    if (!note) {
      return undefined;
    }
    
    note.noteId = obsidianNoteId;
    this.notes.set(note.id, note);
    await this.saveData();
    
    return note;
  }

  /**
   * Get all notes
   * @param conversationId - Optional conversation ID to filter by
   * @returns Array of notes
   */
  public getNotes(conversationId?: string): ConversationNote[] {
    const notes = Array.from(this.notes.values());
    
    if (conversationId) {
      return notes.filter(n => n.conversationId === conversationId);
    }
    
    return notes;
  }

  /**
   * Clear all conversation data
   */
  public async clearData(): Promise<void> {
    this.conversations.clear();
    this.messages.clear();
    this.notes.clear();
    await this.saveData();
  }
} 