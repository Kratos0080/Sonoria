# Chat Feature

This directory contains the components, hooks, and utilities for the chat functionality in NoteChat.

## Component Structure

The chat UI is built from several reusable components:

### Core Components

- `ChatMessage`: Renders a single message with user/AI styling, timestamps, and action buttons
- `MessageList`: Displays a list of messages with auto-scrolling and loading states
- `ChatInput`: Input area with auto-resizing textarea and suggested prompts
- `ChatView`: Main container component that orchestrates the chat experience

### Helper Components

- `CodeBlockRenderer`: Renders code blocks with syntax highlighting and copy functionality
- `MessageRenderer`: Processes message content with markdown and code block support
- `ContextBar`: Shows which notes are included in the current conversation's context

## Hooks

- `useCurrentConversation`: Manages the state of the current conversation
- `useNotes`: Provides utilities for working with Obsidian notes in the chat
- `useCreateNote`: Hook for creating new notes from conversation content

## State Management

The chat feature uses React's Context API for state management:

- `ChatContext`: Provides access to the conversation state, plugin instance, and actions
- `ConversationManager`: Manages conversations, messages, and interactions with the AI

## Utils

- `htmlUtils`: Functions for sanitizing HTML and rendering markdown
- `dateUtils`: Date and time formatting utilities

## Best Practices

1. Keep components focused on a single responsibility
2. Use hooks to extract complex logic from components
3. Keep UI state local to components when possible
4. Use the context for shared state that needs to be accessible across components
5. Follow Obsidian's UI patterns for consistency 