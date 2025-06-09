// import React from 'react'; // Remove unused import
import type { TFile } from 'obsidian';
import NoteSearchResultItem from './NoteSearchResultItem';

interface NoteSearchResultListProps {
  results: TFile[];
  activeNotePaths: string[];
  onAddNote: (file: TFile) => void;
  isLoading: boolean;
  query: string;
}

/**
 * Displays the list of note search results.
 */
function NoteSearchResultList({ 
  results, 
  activeNotePaths, 
  onAddNote, 
  isLoading, 
  query 
}: NoteSearchResultListProps) {
  
  const activePathsSet = new Set(activeNotePaths);
  const filteredResults = results.filter(note => !activePathsSet.has(note.path));

  if (isLoading) {
    return <p className="notechat-search-results__message">Searching...</p>;
  }

  if (!query) {
    return null;
  }

  if (filteredResults.length === 0) {
    return <p className="notechat-search-results__message">No matching notes found.</p>;
  }

  return (
    <div className="notechat-search-results-list">
      {filteredResults.map(note => (
        <NoteSearchResultItem 
          key={note.path}
          note={note}
          onAddNote={onAddNote}
        />
      ))}
    </div>
  );
}

export default NoteSearchResultList; 