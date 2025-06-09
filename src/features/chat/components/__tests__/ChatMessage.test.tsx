// import React from 'react'; // Removed unused import
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Message } from '@core/types/conversation'; // Corrected import path using alias
import { ChatMessage } from '../ChatMessage';

// Mock the utility functions
jest.mock('@utils/dateUtils', () => ({
  formatDate: jest.fn().mockReturnValue('10:00 AM'),
}));

jest.mock('@utils/htmlUtils', () => ({
  sanitizeHtml: jest.fn((html) => html),
}));

describe('ChatMessage Component', () => {
  const mockUserMessage: Message = {
    id: '1',
    conversationId: 'conv1',
    content: 'This is a user message',
    role: 'user',
    timestamp: 1678912345678,
  };
  
  const mockAssistantMessage: Message = {
    id: '2',
    conversationId: 'conv1',
    content: 'This is an assistant message',
    role: 'assistant',
    timestamp: 1678912345679,
  };
  
  const mockCopy = jest.fn();
  const mockAction = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders user message correctly', () => {
    render(
      <ChatMessage 
        message={mockUserMessage} 
        onCopy={mockCopy}
        onAction={mockAction}
      />
    );
    
    // Check that the message content is displayed
    expect(screen.getByText('This is a user message')).toBeInTheDocument();
    
    // Check that the user role is displayed
    expect(screen.getByText('You')).toBeInTheDocument();
    
    // Check that the timestamp is displayed
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    
    // User avatar should have the user class
    const avatarContainer = screen.getByText('👤').closest('div');
    expect(avatarContainer).toHaveClass('user-icon');
  });
  
  test('renders assistant message correctly', () => {
    render(
      <ChatMessage 
        message={mockAssistantMessage} 
        onCopy={mockCopy}
        onAction={mockAction}
      />
    );
    
    // Check that the message content is displayed
    expect(screen.getByText('This is an assistant message')).toBeInTheDocument();
    
    // Check that the assistant role is displayed
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    
    // Check that the timestamp is displayed
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    
    // Assistant avatar should have the assistant class
    const avatarContainer = screen.getByText('🤖').closest('div');
    expect(avatarContainer).toHaveClass('assistant-icon');
  });
  
  test('calls onCopy when copy button is clicked', () => {
    render(
      <ChatMessage 
        message={mockUserMessage} 
        onCopy={mockCopy}
        onAction={mockAction}
      />
    );
    
    // Find and click the copy button
    const copyButton = screen.getByTitle('Copy message');
    fireEvent.click(copyButton);
    
    // Check that onCopy was called with the message content
    expect(mockCopy).toHaveBeenCalledWith('This is a user message');
  });
  
  test('save button is only visible for assistant messages', () => {
    // Render user message first and verify no save button
    const { unmount } = render(
      <ChatMessage 
        message={mockUserMessage} 
        onCopy={mockCopy}
        onAction={mockAction}
      />
    );
    
    // Save button should not be present for user messages
    expect(screen.queryByTitle('Save as note')).not.toBeInTheDocument();
    
    // Unmount and render assistant message
    unmount();
    
    render(
      <ChatMessage 
        message={mockAssistantMessage} 
        onCopy={mockCopy}
        onAction={mockAction}
      />
    );
    
    // Save button should be present for assistant messages
    const saveButton = screen.getByTitle('Save as note');
    expect(saveButton).toBeInTheDocument();
    
    // Click save button and verify onAction called
    fireEvent.click(saveButton);
    expect(mockAction).toHaveBeenCalledWith('save', mockAssistantMessage);
  });
  
  test('respects showAvatar prop', () => {
    // Render with showAvatar=false
    render(
      <ChatMessage 
        message={mockUserMessage} 
        onCopy={mockCopy}
        showAvatar={false}
      />
    );
    
    // Avatar should not be present
    expect(screen.queryByText('👤')).not.toBeInTheDocument();
  });
  
  test('respects showTimestamp prop', () => {
    // Render with showTimestamp=false
    render(
      <ChatMessage 
        message={mockUserMessage} 
        onCopy={mockCopy}
        showTimestamp={false}
      />
    );
    
    // Timestamp should not be present
    expect(screen.queryByText('10:00 AM')).not.toBeInTheDocument();
  });
}); 