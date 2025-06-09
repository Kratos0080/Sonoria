// @ts-expect-error TS6196: PluginSettingTab is used in module augmentation
import type { App, TFile, Plugin, PluginSettingTab } from 'obsidian';
import type { Conversation, Message } from './conversation';
import type { NoteChatSettings } from '@app/settings';
import type { AIClient } from '@app/core/api/aiClient';
import type { NoteService } from '@app/core/services/noteService';
import 'obsidian';

/**
 * Extended EventRef interface
 */
export interface EventRef {
  id: string;
}

/**
 * NoteChatPlugin interface defining the public API of the plugin
 */
export interface NoteChatPlugin extends Plugin {
  conversationManager: {
    currentConversation: Conversation | null;
    isLoading: boolean;
    status: string;
    startConversation: (primaryNoteId: string, noteContent?: string, additionalNoteIds?: string[]) => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    endConversation: () => Promise<void>;
    generateNote: () => Promise<string>;
    createNoteFromContent: (title: string, content: string) => Promise<TFile>;
    saveCurrentConversationToNote: () => Promise<TFile | null>;
    updateConversationNoteIds: (noteIds: string[]) => void;
    addNote: (noteId: string) => Promise<void>;
    removeNote: (noteId: string) => void;
    getMessages: () => Message[];
    on: (eventName: string, listener: (...args: unknown[]) => void) => () => void;
  };
  settings: NoteChatSettings;
  aiClient: AIClient | null;
  noteService: NoteService;
  events: {
    on(name: string, callback: (data: unknown) => void): void;
    off(name: string, callback: (data: unknown) => void): void;
    trigger(name: string, data: unknown): void;
  };
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
  
  // Plugin-specific methods
  openChatView(): void;
  openChatViewWithNote(notePath: string): void;
  
  // Conversation management
  // loadConversations(): Promise<Conversation[]>;
  // saveConversation(conversation: Conversation): Promise<void>;
  // deleteConversation(id: string): Promise<void>;
  
  // Settings
  loadSettings(): Promise<void>;
  saveSettings(): Promise<void>;
}

/**
 * Custom events emitted by the plugin
 */
export enum PluginEvents {
  CONVERSATION_UPDATED = 'conversation-updated',
  CONVERSATION_STARTED = 'conversation-started',
  CONVERSATION_ENDED = 'conversation-ended',
  MESSAGE_ADDED = 'message-added',
  ACTIVE_FILE_CHANGED = 'active-file-changed',
  NOTE_INCLUDED = 'note-included',
  NOTE_EXCLUDED = 'note-excluded'
}

/**
 * Type for component props that require plugin instance
 */
export interface WithPluginProps {
  plugin: NoteChatPlugin;
}

/**
 * Standard Obsidian component props
 */
export interface ObsidianComponentProps {
  app: App;
  onClose?: () => void;
}

declare module 'obsidian' {
  interface App {
    // Use unknown for potentially complex/untyped objects
    commands: unknown; 
    plugins: {
      plugins: Record<string, Plugin>; // Changed from any
      enablePlugin(id: string): Promise<void>;
      disablePlugin(id: string): Promise<void>;
    };
    internalPlugins: {
      plugins: Record<string, Plugin>; // Changed from any
    };
    setting: {
      // Use unknown or a more specific type if known
      activeTab: unknown; 
      settingTabs: Array<PluginSettingTab>; // Changed from Array<Record<string, any>>
      pluginTabs: Array<PluginSettingTab>; // Changed from Array<Record<string, any>>
    };
    // Use specific type from error message
    lastEvent: UserEvent | null; 
  }

  // ... rest of module augmentation ...
} 