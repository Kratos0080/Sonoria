import React from 'react';
import type { TFile } from 'obsidian';
import NoteChip from './NoteChip';

interface SelectedNotesListProps {
  activeNotes: TFile[];
  onRemoveNote: (path: string) => void;
  loadingNotes?: Map<string, 'adding' | 'removing'>;
}

/**
 * Displays the list of currently active context notes using NoteChip components.
 */
const SelectedNotesList: React.FC<SelectedNotesListProps> = ({ 
  activeNotes, 
  onRemoveNote, 
  loadingNotes = new Map() 
}) => {
  return (
    <div className="notechat-selected-notes-list">
      {activeNotes.length === 0 ? (
        <p className="notechat-no-notes">No notes currently in context.</p>
      ) : (
        activeNotes.map(note => (
          <NoteChip 
            key={note.path} 
            note={note} 
            onRemove={onRemoveNote}
            loadingState={loadingNotes.get(note.path) || null}
          />
        ))
      )}
    </div>
  );
};

export default SelectedNotesList; 