/**
 * Core data models for the NoteChat plugin
 */

/**
 * Represents a conversation between the user and the AI
 */
export interface Conversation {
  id: string;                  // Unique identifier
  // assistantThreadId?: string;  // AI Assistants API thread ID - Removed
  noteIds: string[];           // Array of related note identifiers
  activeNoteIds?: string[];    // ADDED: Actively used note IDs for current context
  primaryNoteId?: string;      // Primary/original note identifier (optional)
  title: string;               // Auto-generated or user-defined
  // createdAt: number;           // Timestamp - REMOVED
  // updatedAt: number;           // Timestamp - REMOVED
  messages: Message[];         // Array of messages
  summary?: string;            // Optional AI-generated summary
  isArchived: boolean;         // Flag for archiving
  contextNotes?: {             // Optional metadata about context notes
    [noteId: string]: {
      title: string;           // Note title
      summary?: string;        // Note summary
      included: boolean;       // Whether to include in context
    }
  }
  creationDate: string; // ISO 8601 format - REPLACES createdAt
  lastModified: string; // ISO 8601 format - REPLACES updatedAt
  previous_response_id?: string | null; // Added
  vectorStoreId?: string | null; // Added
  uploadedFileIds?: Record<string, string>; // Added: Maps note path to OpenAI File ID
  error?: string;              // ADDED: To store any error messages related to processing
}

/**
 * Represents a message in a conversation
 */
export interface Message {
  id: string;                  // Unique identifier
  conversationId: string;      // Parent conversation
  content: string;             // Message text
  role: MessageRole;  // Message sender
  timestamp: number;           // Creation time
  isHighlighted?: boolean;     // User-flagged as important
}

/**
 * Represents a note generated from a conversation
 */
export interface ConversationNote {
  id: string;                  // Unique identifier
  conversationId: string;      // Source conversation
  noteId: string;              // Generated note identifier
  title: string;               // Note title
  content: string;             // Formatted note content
  createdAt: number;           // Timestamp
  metadata: {                  // Additional metadata
    tags?: string[];
    source?: string; 
    originalNoteId?: string;
  }
}

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Conversation status
 */
export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
} 