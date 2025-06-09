// import { TFile } from 'obsidian';
// import { Message } from './conversation';
import type { NoteChatPlugin } from './obsidian';

/**
 * Props for the ChatView component
 */
export interface ChatViewProps {
  onClose: () => void;
  eventTarget?: EventTarget;
  plugin: NoteChatPlugin;
}

/**
 * Props for the ChatHeader component
 */
export interface ChatHeaderProps {
  onClose?: () => void;
  title?: string;
  includedNoteCount?: number;
}

/**
 * Props for the ChatInput component
 */
export interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  suggestedPrompts?: Array<{ title: string; text: string }>;
  onPromptClick?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}

/**
 * Props for the LoadingIndicator component
 */
export interface LoadingIndicatorProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Props for the ChatMessageActions component
 */
export interface ChatMessageActionsProps {
  messageId: string;
  onAction: (actionType: string, messageId: string) => void;
  isUserMessage?: boolean;
} 