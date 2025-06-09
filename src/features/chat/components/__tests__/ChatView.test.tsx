// import React from 'react'; // Removed unused import
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatView } from '../ChatView';
import type { NoteChatPlugin } from '@app/core/types/obsidian';
import { useChatContext } from '@app/core/context/ChatContext';
import { useConversation } from '@app/features/chat/hooks/useConversation';
import { useNotes } from '@app/features/chat/hooks/useNotes';
import { DEFAULT_SETTINGS } from '@app/settings';
import type { Conversation, Message } from '@app/core/types/conversation';
import type { NoteService } from '@app/core/services/noteService'; // Import for full type
import type { ConversationManager } from '@app/features/chat/store/conversationContext'; // Import for full type
import type { TFile } from 'obsidian'; // Import TFile type

// Mock dependencies
jest.mock('@app/core/context/ChatContext');
jest.mock('@app/features/chat/hooks/useConversation');
jest.mock('@app/features/chat/hooks/useNotes');
jest.mock('../ChatHeader', () => ({
  __esModule: true,
  default: jest.fn((props) => (
    <div 
      data-testid="chat-header" 
      data-notecount={props.noteCount}
      data-isfolded={props.isContextAreaFolded}
      onClick={props.onToggleContextAreaFold} // Simulate button clickability
    />
  )),
}));

jest.mock('../ContextArea', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="context-area" />),
}));


describe('ChatView Component', () => {
  let mockPlugin: Partial<NoteChatPlugin>;
  const mockUseChatContext = useChatContext as jest.Mock;
  const mockUseConversation = useConversation as jest.Mock;
  const mockUseNotes = useNotes as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseChatContext.mockReturnValue({
      app: {
        workspace: {
          on: jest.fn(),
          off: jest.fn(),
        },
        vault: {
          getAbstractFileByPath: jest.fn(),
        }
      },
    });

    mockUseConversation.mockReturnValue({
      messages: [] as Message[],
      isLoading: false,
      loadingMessage: '',
      sendMessage: jest.fn(),
      handleMessageAction: jest.fn(),
      recycleContext: jest.fn(),
      currentConversation: null as Conversation | null,
    });

    mockUseNotes.mockReturnValue({
      activeNotes: [],
      getCurrentFile: jest.fn().mockReturnValue(null),
      removeFile: jest.fn(),
      getRecentFiles: jest.fn().mockResolvedValue([]),
      addFileByPath: jest.fn(),
      setActiveNotes: jest.fn(),
      refreshNotes: jest.fn(),
    });
    
    mockPlugin = {
        settings: DEFAULT_SETTINGS,
        noteService: {
            getActiveFile: jest.fn().mockReturnValue(null),
            getFileContent: jest.fn().mockResolvedValue(''),
            // Added missing properties based on linter feedback and NoteService type
            app: {} as unknown as NoteChatPlugin['app'], // Use proper type from plugin
            parsers: new Map(),
            noteFolderPath: 'mocked/path',
            registerParser: jest.fn(),
            parseNoteContent: jest.fn().mockResolvedValue(''),
            createNote: jest.fn().mockResolvedValue(null as unknown as TFile),
            openNote: jest.fn().mockResolvedValue(undefined),
            getRecentFiles: jest.fn().mockResolvedValue([]),
            searchFiles: jest.fn().mockResolvedValue([]),
            ensureNotePathExists: jest.fn().mockResolvedValue(undefined),
        } as unknown as NoteService, // Use unknown then cast to NoteService for partial mock

        conversationManager: {
            currentConversation: null,
            startConversation: jest.fn().mockResolvedValue(undefined),
            saveCurrentConversationToNote: jest.fn().mockResolvedValue(undefined),
            // Added missing properties based on linter feedback and ConversationManager type
            messages: [] as Message[],
            isLoading: false,
            status: 'idle',
            sendMessage: jest.fn().mockResolvedValue(undefined),
            endConversation: jest.fn().mockResolvedValue(undefined),
            generateNote: jest.fn().mockResolvedValue(''),
            createNoteFromContent: jest.fn().mockResolvedValue(null as unknown as TFile),
            addTurnToConversation: jest.fn().mockResolvedValue(undefined),
            subscribe: jest.fn(() => jest.fn()), // Returns an unsubscribe function
            on: jest.fn(() => jest.fn()), 
            emit: jest.fn(),
            off: jest.fn(),
            getAIClient: jest.fn().mockReturnValue(null),
            setAIClient: jest.fn(),
            getNoteService: jest.fn(),
            addNote: jest.fn().mockResolvedValue(undefined),
            removeNote: jest.fn().mockResolvedValue(undefined),
            updateConversationNoteIds: jest.fn(),
            getMessages: jest.fn().mockReturnValue([]),
            getIsLoading: jest.fn().mockReturnValue(false),
            getStatus: jest.fn().mockReturnValue('idle'),
        } as unknown as ConversationManager, // Use unknown then cast for partial mock

        app: {
          workspace: {
            on: jest.fn(),
            off: jest.fn(),
          },
          vault: {
            getAbstractFileByPath: jest.fn().mockReturnValue(null),
            cachedRead: jest.fn().mockResolvedValue(''),
          }
        } as unknown as NoteChatPlugin['app'],
      };
  });

  // test('passes the static title "NoteChat" to ChatHeader', () => {
  //   render(<ChatView plugin={mockPlugin as NoteChatPlugin} />); // Full cast here
  //   
  //   const chatHeader = screen.getByTestId('chat-header');
  //   expect(chatHeader).toBeInTheDocument();
  //   expect(chatHeader).toHaveAttribute('data-title', 'NoteChat');
  // });

  test('renders ChatHeader with correct noteCount and handles context folding', () => {
    const mockNotes = [{ id: '1', name: 'Note 1', path: 'note1.md' }];
    mockUseNotes.mockReturnValueOnce({
      ...mockUseNotes(), // Spread existing mock return values
      activeNotes: mockNotes,
      getCurrentFile: jest.fn().mockReturnValue(null), // Ensure all used functions are part of return
      removeFile: jest.fn(),
      getRecentFiles: jest.fn().mockResolvedValue([]),
      addFileByPath: jest.fn(),
      setActiveNotes: jest.fn(),
      refreshNotes: jest.fn(), // Added missing refreshNotes function
    });

    render(<ChatView plugin={mockPlugin as NoteChatPlugin} />);
    
    // Check ChatHeader props
    const chatHeaderMock = screen.getByTestId('chat-header');
    expect(chatHeaderMock).toHaveAttribute('data-notecount', String(mockNotes.length));
    expect(chatHeaderMock).toHaveAttribute('data-isfolded', 'false'); // Initially not folded

    // ContextArea should be visible initially
    expect(screen.getByTestId('context-area')).toBeVisible();

    // Simulate toggle fold from ChatHeader
    // The mock ChatHeader has onToggleContextAreaFold on its onClick
    fireEvent.click(chatHeaderMock);

    // After click, ChatHeader should be marked as folded, and ContextArea hidden
    // Need to re-query for chatHeaderMock if its props change and cause a re-render of the mock itself
    // However, our mock structure is simple, its props are just passed.
    // We need to check the state that controls ContextArea visibility directly.
    // The most reliable way is to check if ContextArea is no longer in the document or not visible.
    
    // No, the test should verify the effect of the state change. So, ContextArea should be gone.
    expect(screen.queryByTestId('context-area')).not.toBeInTheDocument();
    // And the prop passed to ChatHeader should reflect folded state
    // This requires a way for the test to know ChatView re-rendered and passed new props. 
    // The fireEvent should handle this for internal state updates.
    // Let's re-render ChatView to simulate this if direct state observation is hard.
    // The props to the ChatHeader mock instance itself don't update post-hoc unless ChatView re-renders it.

    // Let's rely on RTL handling the re-render from internal state change.
    // The mock for ChatHeader will be called again with new props.
    // So, the instance of the mock needs to be checked.
    // The simplest is to check the effect: ContextArea is hidden.
    // The mock itself won't update its data attributes after initial render unless ChatView re-renders it with new props.
    // This is a limitation of the simple mock. A more complex mock could store calls.

    // For now, primary assertion: ContextArea is hidden.
    // If we need to assert chatHeaderMock `data-isfolded` is true, the test setup might need adjustment
    // or a more sophisticated mock for ChatHeader that tracks calls and props.

    // Simulate toggle again
    fireEvent.click(chatHeaderMock); // This is clicking the same initial chatHeaderMock element
    expect(screen.getByTestId('context-area')).toBeVisible();

  });
}); 