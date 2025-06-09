import { useState, useEffect } from 'react';
import type { TFile } from 'obsidian';
import NoteSearchInput from './NoteSearchInput';
import NoteSearchResultList from './NoteSearchResultList';
import { useChatContext } from '../../../core/context/ChatContext'; // To access app

interface SearchNotesTabProps {
  onAddNote: (file: TFile) => void;
  activeNotePaths: string[];
}

const SEARCH_DELAY_MS = 250; // Debounce delay

/**
 * Tab content for searching notes in the vault.
 */
function SearchNotesTab({ onAddNote, activeNotePaths }: SearchNotesTabProps) {
  const { app } = useChatContext(); // Get app instance for vault access
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Simple debounce mechanism
    const handler = setTimeout(() => {
      if (searchQuery.trim() === '') {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Basic search: filter all markdown files by name (case-insensitive)
        // TODO: Consider using Obsidian's QuickSwitcher logic or a more robust search API if available
        const allMarkdownFiles = app.vault.getMarkdownFiles();
        const lowerCaseQuery = searchQuery.toLowerCase();
        const results = allMarkdownFiles.filter(file => 
          file.basename.toLowerCase().includes(lowerCaseQuery)
        );
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching notes:", error);
        setSearchResults([]); // Clear results on error
      } finally {
        setIsLoading(false);
      }
    }, SEARCH_DELAY_MS);

    // Cleanup function to cancel the timeout if query changes quickly
    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, app.vault]); // Re-run search when query changes

  return (
    <div className="notechat-search-notes-tab">
      <NoteSearchInput 
        query={searchQuery}
        onChange={setSearchQuery} 
      />
      <NoteSearchResultList 
        results={searchResults}
        activeNotePaths={activeNotePaths}
        onAddNote={onAddNote}
        isLoading={isLoading}
        query={searchQuery}
      />
    </div>
  );
}

export default SearchNotesTab; 