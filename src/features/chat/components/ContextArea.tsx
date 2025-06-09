import React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { TFile } from 'obsidian';
import SelectedNotesList from './SelectedNotesList'; // Import the component
import type { NoteSourceTab } from './ContextTabs';
import NoteSourceTabs from './ContextTabs'; // Correct: Default import
import AddCurrentNoteButton from './AddCurrentNoteButton'; // Import new component
import useClickOutside from '../../../core/hooks/useClickOutside'; // Import the new hook
import { Clock, Search } from 'lucide-react';

/** Props for the ContextArea component */
interface ContextAreaProps {
  /** Array of TFile objects currently included in the context. */
  activeNotes: TFile[]; 
  /** Callback function to remove a note from the context by its path. */
  onRemoveNote: (path: string) => void; 
  /** Callback function to add the currently active Obsidian note to the context. */
  onAddCurrentNote: () => void; 
  /** Callback function to add a note to the context by its file path. */
  onAddNote: (file: TFile) => void;
  /** Boolean signal to force close any open popups/tabs within the context area. */
  forceCloseSignal?: boolean;
  /** The currently active TFile in the workspace, or null. */
  currentFile: TFile | null;
  /** Loading state for notes being added or removed */
  loadingNotes?: Map<string, 'adding' | 'removing'>;
}

/**
 * Container component for the context management area.
 * Holds the list of selected notes and the controls for adding notes.
 */
const ContextArea: React.FC<ContextAreaProps> = ({ 
  activeNotes,
  onRemoveNote,
  onAddCurrentNote,
  onAddNote,
  forceCloseSignal,
  currentFile,
  loadingNotes
}) => {
  const [activeTab, setActiveTab] = useState<NoteSourceTab | null>(null);
  const [isTabContentVisible, setIsTabContentVisible] = useState<boolean>(false);
  const tabContentRef = useRef<HTMLDivElement>(null); // Ref for the tab content area
  
  // Click outside handler
  useClickOutside(tabContentRef, () => {
    if (isTabContentVisible) {
      setIsTabContentVisible(false);
    }
  });

  useEffect(() => {
    console.log(`ContextArea: forceCloseSignal changed to ${forceCloseSignal}. Setting isTabContentVisible to false.`);
    setIsTabContentVisible(false);
  }, [forceCloseSignal]);

  const activeNotePaths = activeNotes.map(note => note.path);

  const isCurrentNoteAdded = currentFile ? activeNotePaths.includes(currentFile.path) : false;

  const handleTabClick = (tab: NoteSourceTab) => {
    if (tab === activeTab) {
      setIsTabContentVisible(prev => !prev);
    } else {
      setActiveTab(tab);
      setIsTabContentVisible(true);
    }
  };

  return (
    <div className="notechat-context-area">
      <SelectedNotesList 
        activeNotes={activeNotes} 
        onRemoveNote={onRemoveNote}
        loadingNotes={loadingNotes}
      />
      
      <div className="notechat-add-note-controls">
        <AddCurrentNoteButton 
          onClick={onAddCurrentNote} 
          disabled={isCurrentNoteAdded}
        />
        <button 
          className={`notechat-note-source-tabs__tab ${activeTab === 'Recent' && isTabContentVisible ? 'is-active' : ''}`} 
          onClick={() => handleTabClick('Recent')}
        >
          <Clock size={12} />
          Recent
        </button>
        <button 
          className={`notechat-note-source-tabs__tab ${activeTab === 'Search' && isTabContentVisible ? 'is-active' : ''}`} 
          onClick={() => handleTabClick('Search')}
        >
          <Search size={12} />
          Search
        </button>
      </div>

      <div ref={tabContentRef} className={`context-tabs-content ${isTabContentVisible && activeTab ? 'visible' : ''}`}>
        {activeTab && isTabContentVisible && (
          <NoteSourceTabs
            activeTab={activeTab}
            activeNotePaths={activeNotePaths}
            onAddNote={onAddNote}
          />
        )}
      </div>
    </div>
  );
};

export default ContextArea; 