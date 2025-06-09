import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextInputArea } from '../TextInputArea'; // Adjust path as necessary
import { SendButton } from '../SendButton'; // Assuming SendButton is separate
import { SuggestedPromptsButton } from '../SuggestedPromptsButton'; // Assuming SuggestedPromptsButton is separate

// Mock child components to isolate TextInputArea logic if needed, or test them integrated
jest.mock('../SendButton', () => ({
  SendButton: jest.fn(({ onClick, disabled }) => (
    <button data-testid="send-button" onClick={onClick} disabled={disabled}>
      Send
    </button>
  )),
}));

jest.mock('../SuggestedPromptsButton', () => ({
  SuggestedPromptsButton: jest.fn(({ onSelectPrompt, prompts }) => (
    <div data-testid="suggested-prompts-button">
      {/* Mock behavior of SuggestedPromptsButton for onSelectPrompt */}
      {prompts.map((p: { title: string; text: string }) => (
        <button key={p.text} onClick={() => onSelectPrompt(p.text)}>
          {p.title}
        </button>
      ))}
    </div>
  )),
}));


describe('TextInputArea', () => {
  const mockOnInputChange = jest.fn();
  const mockOnSendMessage = jest.fn();
  const mockOnSelectPrompt = jest.fn();
  const defaultPrompts = [
    { title: 'Prompt 1', text: 'Test prompt 1' },
    { title: 'Prompt 2', text: 'Test prompt 2' },
  ];

  const renderComponent = (props: Partial<React.ComponentProps<typeof TextInputArea>> = {}) => {
    return render(
      <TextInputArea
        inputValue=""
        onInputChange={mockOnInputChange}
        onSendMessage={mockOnSendMessage}
        onSelectPrompt={mockOnSelectPrompt}
        isSending={false}
        prompts={defaultPrompts}
        {...props}
      />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-assign mock implementations if they were changed in a test
    (SendButton as jest.Mock).mockImplementation(({ onClick, disabled }) => (
      <button data-testid="send-button" onClick={onClick} disabled={disabled}>Send</button>
    ));
    (SuggestedPromptsButton as jest.Mock).mockImplementation(({ onSelectPrompt, prompts }) => (
        <div data-testid="suggested-prompts-button">
          {prompts.map((p: { title: string; text: string }) => (
            <button key={p.text} onClick={() => onSelectPrompt(p.text)}>
              {p.title}
            </button>
          ))}
        </div>
      ));
  });

  // SendButton Tests
  it('should call onSendMessage when SendButton is clicked and input is not empty', () => {
    renderComponent({ inputValue: 'Hello' });
    fireEvent.click(screen.getByTestId('send-button'));
    expect(mockOnSendMessage).toHaveBeenCalledTimes(1);
  });

  it('should disable SendButton when inputValue is empty', () => {
    renderComponent({ inputValue: '' });
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('should disable SendButton when inputValue is only whitespace', () => {
    renderComponent({ inputValue: '   ' });
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('should enable SendButton when inputValue has text', () => {
    renderComponent({ inputValue: 'Not empty' });
    expect(screen.getByTestId('send-button')).toBeEnabled();
  });

  it('should disable SendButton when isSending is true', () => {
    renderComponent({ inputValue: 'Hello', isSending: true });
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  // SuggestedPromptsButton Tests
  it('should render SuggestedPromptsButton', () => {
    renderComponent();
    expect(screen.getByTestId('suggested-prompts-button')).toBeInTheDocument();
  });

  it('should call onSelectPrompt with the prompt text when a suggested prompt is clicked', () => {
    renderComponent();
    // In our mock, the SuggestedPromptsButton renders buttons for each prompt.
    // We'll click the first one.
    const promptButton = screen.getByText(defaultPrompts[0].title);
    fireEvent.click(promptButton);
    expect(mockOnSelectPrompt).toHaveBeenCalledTimes(1);
    expect(mockOnSelectPrompt).toHaveBeenCalledWith(defaultPrompts[0].text);
  });

  // Test for ChatInput interactions (optional, as ChatInput has its own tests ideally)
  it('should call onInputChange when ChatInput value changes', () => {
    // For this test, we might need to not mock ChatInput or use a more integrated approach
    // Temporarily unmock ChatInput if it was mocked globally or provide a passthrough mock
    // This is a placeholder for a more complex test if needed.
  });

}); 