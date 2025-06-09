// import * as React from 'react'; // Remove unused import
import { useState, useEffect } from 'react';
import type { TFile } from 'obsidian';
import { useNotes } from '../hooks/useNotes';
import RecentNoteItem from './RecentNoteItem';

interface RecentNotesTabProps {
  onAddNote: (file: TFile) => void;
  activeNotePaths: string[]; // Paths of notes currently in context
}

const MAX_RECENT_NOTES_DISPLAY = 5;
const FETCH_LIMIT = 20; // Fetch more initially to allow filtering

/**
 * Tab content for displaying and adding recent notes.
 */
function RecentNotesTab({ onAddNote, activeNotePaths }: RecentNotesTabProps) {
  const { getRecentFiles } = useNotes();
  const [allRecentNotes, setAllRecentNotes] = useState<TFile[]>([]);

  useEffect(() => {
    // Make the effect's callback async
    const fetchFiles = async () => {
      try {
        // Await the result of the async function
        const files = await getRecentFiles(FETCH_LIMIT);
        setAllRecentNotes(files);
      } catch (error) {
        console.error("RecentNotesTab: Failed to fetch recent files:", error);
        // Optionally set an error state here
      }
    };
    fetchFiles();
  }, [getRecentFiles]); // Add getRecentFiles to dependency array

  // Filter and limit the notes to display directly in render
  const activePathsSet = new Set(activeNotePaths);
  const notesToDisplay = allRecentNotes
      .filter(note => !activePathsSet.has(note.path)) 
      .slice(0, MAX_RECENT_NOTES_DISPLAY); 

  return (
    <div className="notechat-recent-notes-tab">
      {notesToDisplay.length === 0 ? (
        <p className="notechat-recent-notes-tab__empty">No other recent notes found.</p>
      ) : (
        <div className="notechat-recent-notes-tab__list">
          {notesToDisplay.map(note => (
            <RecentNoteItem 
              key={note.path}
              note={note}
              onAddNote={onAddNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentNotesTab; 