import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContextArea from '../ContextArea';
import type { TFile } from 'obsidian';

// Mock child components and hooks - Use function expressions to avoid hoisting issues
jest.mock('../SelectedNotesList', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="selected-notes-list" />),
}));
jest.mock('../AddCurrentNoteButton', () => ({
  __esModule: true,
  default: jest.fn(() => <button data-testid="add-current-note-button" />),
}));
jest.mock('../ContextTabs', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="note-source-tabs" />),
}));
jest.mock('../../../../core/hooks/useClickOutside', () => ({
  __esModule: true,
  default: jest.fn((_ref, callback) => {
    // Store the callback so we can call it manually in tests
    (global as unknown as { lastClickOutsideCallback: (event: MouseEvent) => void }).lastClickOutsideCallback = callback;
  }),
}));

// Import the mocked modules to get access to jest functions
import ContextTabs from '../ContextTabs';

const mockNoteSourceTabs = ContextTabs as jest.MockedFunction<typeof ContextTabs>;

const mockActiveNotes: TFile[] = [];
const mockOnRemoveNote = jest.fn();
const mockOnAddCurrentNote = jest.fn();
const mockOnAddNote = jest.fn();
const mockCurrentFile = null;

const defaultProps = {
  activeNotes: mockActiveNotes,
  onRemoveNote: mockOnRemoveNote,
  onAddCurrentNote: mockOnAddCurrentNote,
  onAddNote: mockOnAddNote,
  forceCloseSignal: false,
  currentFile: mockCurrentFile,
};

describe('ContextArea Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockNoteSourceTabs calls before each test that checks it
    mockNoteSourceTabs.mockClear(); 
  });

  test('renders SelectedNotesList and AddCurrentNoteButton', () => {
    render(<ContextArea {...defaultProps} />);
    expect(screen.getByTestId('selected-notes-list')).toBeInTheDocument();
    expect(screen.getByTestId('add-current-note-button')).toBeInTheDocument();
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  test('toggles tab content visibility and changes active tab on button click', () => {
    render(<ContextArea {...defaultProps} />);
    const recentTabButton = screen.getByText('Recent');
    const searchTabButton = screen.getByText('Search');

    // Initially, no tab content should be visible
    expect(mockNoteSourceTabs).not.toHaveBeenCalled();
    expect(screen.queryByTestId('note-source-tabs')).not.toBeInTheDocument();

    // Click Recent tab
    fireEvent.click(recentTabButton);
    expect(mockNoteSourceTabs).toHaveBeenCalledTimes(1);
    expect(mockNoteSourceTabs).toHaveBeenLastCalledWith(expect.objectContaining({ activeTab: 'Recent' }), {});
    expect(screen.getByTestId('note-source-tabs')).toBeVisible();

    // Click Recent tab again to hide
    fireEvent.click(recentTabButton);
    expect(mockNoteSourceTabs).toHaveBeenCalledTimes(1); // Should not be called again, just hidden
    expect(screen.queryByTestId('note-source-tabs')).not.toBeInTheDocument();

    // Click Search tab
    fireEvent.click(searchTabButton);
    expect(mockNoteSourceTabs).toHaveBeenCalledTimes(2);
    expect(mockNoteSourceTabs).toHaveBeenLastCalledWith(expect.objectContaining({ activeTab: 'Search' }), {});
    expect(screen.getByTestId('note-source-tabs')).toBeVisible();

    // Click another tab (Recent) while Search is open
    fireEvent.click(recentTabButton);
    expect(mockNoteSourceTabs).toHaveBeenCalledTimes(3);
    expect(mockNoteSourceTabs).toHaveBeenLastCalledWith(expect.objectContaining({ activeTab: 'Recent' }), {});
    expect(screen.getByTestId('note-source-tabs')).toBeVisible(); // Should still be visible but with new tab
  });

  test('closes tab content on click outside', () => {
    // Setup: Open a tab first
    render(<ContextArea {...defaultProps} />);
    const recentTabButton = screen.getByText('Recent');
    fireEvent.click(recentTabButton);
    expect(screen.getByTestId('note-source-tabs')).toBeVisible();

    // Get the stored callback from our mock
    const clickOutsideCallback = (global as unknown as { lastClickOutsideCallback: (event: MouseEvent) => void }).lastClickOutsideCallback;
    expect(clickOutsideCallback).toBeDefined();
    
    // Call the callback with a mock event to simulate click outside
    act(() => {
      clickOutsideCallback(new MouseEvent('mousedown'));
    });

    expect(screen.queryByTestId('note-source-tabs')).not.toBeInTheDocument();
  });

  test('closes tab content when forceCloseSignal changes', () => {
    const { rerender } = render(<ContextArea {...defaultProps} forceCloseSignal={false} />); 
    const recentTabButton = screen.getByText('Recent');

    // Open a tab
    fireEvent.click(recentTabButton);
    expect(screen.getByTestId('note-source-tabs')).toBeVisible();

    // Simulate forceCloseSignal toggle by re-rendering with new prop value
    rerender(<ContextArea {...defaultProps} forceCloseSignal={true} />);
    expect(screen.queryByTestId('note-source-tabs')).not.toBeInTheDocument();
    
    // Optional: Test that it closes even if signal toggles back (as per current useEffect logic)
    // rerender(<ContextArea {...defaultProps} forceCloseSignal={false} />); // Open it again first
    // fireEvent.click(recentTabButton);
    // expect(screen.getByTestId('note-source-tabs')).toBeVisible();
    // rerender(<ContextArea {...defaultProps} forceCloseSignal={true} />); // Toggle to true
    // expect(screen.queryByTestId('note-source-tabs')).not.toBeInTheDocument(); 
    // rerender(<ContextArea {...defaultProps} forceCloseSignal={false} />); // Toggle back to false
    // expect(screen.queryByTestId('note-source-tabs')).not.toBeInTheDocument(); // Should still be closed
  });

}); 