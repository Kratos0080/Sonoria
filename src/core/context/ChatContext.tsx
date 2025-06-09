import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import type { App, TFile } from 'obsidian';
// import type { ConversationManager } from '@features/chat/store/conversationContext';
import type NoteChatPlugin from '@app/main'; // Import the plugin type
// Message and Conversation types might not be needed here anymore if not used by UI state
// import { Message, Conversation } from '../types/conversation'; 
// Keep import for type safety of plugin prop?
// import { ConversationManager } from '../../features/chat/store/conversationContext'; 

// Define the shape of our chat context
export interface ChatContextType {
  app: App;
  // Use a more specific type if possible, e.g., import NoteChatPlugin from '../main'
  plugin: NoteChatPlugin | null;
  
  // UI state for note selector
  showNoteSelector: boolean;
  setShowNoteSelector: (show: boolean) => void;
  selectorMode: 'current' | 'search' | 'recent';
  setSelectorMode: (mode: 'current' | 'search' | 'recent') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: TFile[];
  setSearchResults: (results: TFile[]) => void;
  
  // UI state for prompts and save options
  showPrompts: boolean;
  setShowPrompts: (show: boolean) => void;
  showSaveOptions: boolean;
  setShowSaveOptions: (show: boolean) => void;
}

// Define a default context value
const defaultChatContextValue: ChatContextType = {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ChatProvider always provides a non-null app instance
  app: null!, 
  plugin: null, // plugin can be null as per ChatContextType
  showNoteSelector: false,
  setShowNoteSelector: () => {},
  selectorMode: 'recent',
  setSelectorMode: () => {},
  searchQuery: '',
  setSearchQuery: () => {},
  searchResults: [],
  setSearchResults: () => {},
  showPrompts: false,
  setShowPrompts: () => {},
  showSaveOptions: false,
  setShowSaveOptions: () => {},
};

// Use named createContext
const ChatContext = createContext<ChatContextType>(defaultChatContextValue);

// Props for the context provider
interface ChatProviderProps {
  // Use a more specific type if possible
  plugin: NoteChatPlugin; // Use specific plugin type
  children: ReactNode;
}

// Provider component that wraps the chat UI
export const ChatProvider: React.FC<ChatProviderProps> = ({ plugin, children }): JSX.Element => {
  const app = plugin.app;
  
  // Use named useState
  const [showNoteSelector, setShowNoteSelector] = useState(false);
  const [selectorMode, setSelectorMode] = useState<'current' | 'search' | 'recent'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TFile[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);

  const contextValue: ChatContextType = {
    app,
    plugin,
    showNoteSelector,
    setShowNoteSelector,
    selectorMode,
    setSelectorMode,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    showPrompts,
    setShowPrompts,
    showSaveOptions,
    setShowSaveOptions,
  };
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Use named useContext
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

/**
 * Error boundary state interface
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for handling React errors gracefully
 */
export class ErrorBoundary extends React.Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ChatView Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="notechat-error">
          <h3>Something went wrong</h3>
          <p>Please try refreshing the view or restarting Obsidian.</p>
          <details>
            <summary>Error details</summary>
            <code>{this.state.error?.message}</code>
          </details>
          <button 
            className="notechat-button notechat-button-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Helper function to generate AI responses based on the prompt text
 */
/*
function getAIResponse(text: string): string {
  // Simulate API call
  console.log("Simulating AI API call with:", text);
  return `AI response to \"${text}\"`;
}
*/ 