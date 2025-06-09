// import React from 'react'; // Remove unused import
import type { TFile } from 'obsidian';
import RecentNotesTab from './RecentNotesTab';
import SearchNotesTab from './SearchNotesTab'; // Import the new component

// Define the possible tabs
export type NoteSourceTab = 'Recent' | 'Search';

interface NoteSourceTabsProps {
  activeTab: NoteSourceTab; // Receive active tab from parent
  activeNotePaths: string[]; // Pass this down
  onAddNote: (file: TFile) => void; // Pass this down
}

/**
 * Renders the *content* for the selected note source tab (Recent or Search).
 * Visibility is controlled by the parent component.
 */
function NoteSourceTabs({ activeTab, activeNotePaths, onAddNote }: NoteSourceTabsProps) {

  // Render content directly based on active tab
  switch (activeTab) {
    case 'Recent':
      return <RecentNotesTab onAddNote={onAddNote} activeNotePaths={activeNotePaths} />;
    case 'Search':
      return <SearchNotesTab onAddNote={onAddNote} activeNotePaths={activeNotePaths} />;
    default:
      console.warn("Invalid activeTab in NoteSourceTabs:", activeTab);
      return null;
  }
}

export default NoteSourceTabs; 