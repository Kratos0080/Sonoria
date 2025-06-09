import { useEffect, useState, useCallback, useRef } from 'react';
import { useChatContext } from '../../../core/context/ChatContext';
import type { ConversationManager } from '../store/conversationContext';
import { TFile, Notice } from 'obsidian';

/**
 * Hook for managing notes displayed in the UI, synced with ConversationManager.
 */
export function useNotes() {
  const { app, plugin } = useChatContext();
  const [activeNotes, setActiveNotes] = useState<TFile[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<Map<string, 'adding' | 'removing'>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 🔧 CLOSURE FIX: Use ref to ensure refreshNotes always sees current loadingNotes
  const loadingNotesRef = useRef(loadingNotes);
  loadingNotesRef.current = loadingNotes;
  
  // Use optional chaining as plugin from useChatContext can be null
  const noteService = plugin?.noteService;
  
  let conversationManager: ConversationManager | null = null;
  if (plugin) {
    conversationManager = plugin.conversationManager;
  } else {
    console.warn('useNotes: Plugin instance is not yet available.');
  }
  
  const refreshNotes = useCallback(() => {
    if (!app || !conversationManager) {
      console.warn('useNotes.refreshNotes: App or ConversationManager not available');
      setActiveNotes([]);
      return;
    }
    
    // 🔧 RACE CONDITION FIX: Skip refresh during active loading operations
    // This prevents refreshNotes from overriding optimistic UI updates
    // Use ref to get current loadingNotes state to avoid stale closure
    const currentLoadingNotes = loadingNotesRef.current;
    if (currentLoadingNotes.size > 0) {
      console.log('useNotes.refreshNotes: Skipping refresh due to active loading operations:', Array.from(currentLoadingNotes.keys()));
      return;
    }
    
    const currentConversation = conversationManager.currentConversation;
    const noteIds = currentConversation?.noteIds || [];
    console.log("useNotes.refreshNotes: Current noteIds from manager:", noteIds);

    if (noteIds.length === 0) {
      setActiveNotes([]);
      return;
    }

    const noteFiles: TFile[] = [];
    for (const noteId of noteIds) {
      const file = app.vault.getAbstractFileByPath(noteId);
      if (file instanceof TFile) {
        noteFiles.push(file);
      } else {
        console.warn(`useNotes.refreshNotes: Could not find TFile for noteId from manager: ${noteId}`);
      }
    }
    console.log("useNotes.refreshNotes: Setting activeNotes based on manager state:", noteFiles.map(f=>f.basename));
    setActiveNotes(prevNotes => {
       const prevPaths = prevNotes.map(f => f.path).sort();
       const nextPaths = noteFiles.map(f => f.path).sort();
       if (JSON.stringify(prevPaths) === JSON.stringify(nextPaths)) {
          return prevNotes;
       }
       return noteFiles;
    });
  }, [app, conversationManager]); // Remove loadingNotes from deps to prevent recreation
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (conversationManager) {
      unsubscribe = conversationManager.on('update', refreshNotes);
    } else {
      console.warn('useNotes: ConversationManager not available for subscription.');
    }
    
    refreshNotes();
      
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [conversationManager, refreshNotes]);
  
  const getCurrentFile = useCallback((): TFile | null => {
    if (!noteService) return null;
    return noteService.getActiveFile();
  }, [noteService]);
  
  const addCurrentFile = useCallback(async () => {
    const currentFile = getCurrentFile();
    if (!currentFile) {
      new Notice('No file is currently active.');
      return;
    }
    if (!conversationManager) {
      new Notice('Error: Conversation manager not ready.'); return;
    }
    try {
      await conversationManager.addNote(currentFile.path);
    } catch (err) {
      console.error('Error adding current file via manager:', err);
      new Notice(`Error adding current file: ${err.message || 'Unknown error'}`);
    }
  }, [getCurrentFile, conversationManager]);
  
  const addFileByPath = useCallback(async (path: string) => {
    if (!conversationManager) {
      new Notice('Error: Conversation manager not ready.'); return;
    }
    try {
      await conversationManager.addNote(path);
    } catch (err) {
      console.error('Error adding file by path via manager:', err);
      new Notice(`Failed to add file: ${path}`);
    }
  }, [conversationManager]);
  
  const removeFile = useCallback(async (path: string) => {
    if (!conversationManager) {
      new Notice('Error: Conversation manager not ready.'); return;
    }
    try {
      await conversationManager.removeNote(path);
      new Notice(`Removed note: ${path.split('/').pop()}`);
    } catch (err) {
      console.error('Error removing file via manager:', err);
      new Notice(`Failed to remove file: ${path}`);
    }
  }, [conversationManager]);
  
  const getRecentFiles = useCallback(async (limit = 5): Promise<TFile[]> => {
    if (!noteService) return [];
    const files = await noteService.getRecentFiles();
    return files.slice(0, limit);
  }, [noteService]);
  
  const searchFiles = useCallback(async (query: string): Promise<TFile[]> => {
    if (!noteService) return [];
    if (!query || query.trim().length === 0) {
      return [];
    }
    setIsLoading(true);
    setError(null);
    console.log(`useNotes: Calling noteService.searchFiles with query: ${query}`);
    try {
      const filteredFiles = await noteService.searchFiles(query);
      console.log(`useNotes: Received ${filteredFiles.length} files from noteService.`);
      setIsLoading(false);
      return filteredFiles;
    } catch (err) {
      console.error('Error searching files via noteService:', err);
      setError(`Failed to search files: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
      return [];
    }
  }, [noteService]);

  const addNote = useCallback(async (noteId: string, file?: TFile): Promise<void> => {
    console.log('useNotes.addNote: Starting with noteId:', noteId);
    
    let resolvedFile: TFile;
    if (!file) {
      const foundFile = app.vault.getAbstractFileByPath(noteId);
      if (!foundFile || !(foundFile instanceof TFile)) {
        console.warn('useNotes.addNote: File not found:', noteId);
        return;
      }
      resolvedFile = foundFile as TFile;
    } else {
      resolvedFile = file;
    }

    console.log('useNotes.addNote: Adding to activeNotes immediately for instant feedback');
    // Immediately add to UI for instant feedback
    setActiveNotes(prev => {
      // Check if already exists
      if (prev.some(note => note.path === resolvedFile.path)) {
        console.log('useNotes.addNote: Note already exists in activeNotes');
        return prev;
      }
      
      console.log('useNotes.addNote: Adding note to activeNotes:', resolvedFile.basename);
      return [...prev, resolvedFile];
    });
    
    console.log('useNotes.addNote: Setting loading state for animation');
    // Set loading state for animation
    setLoadingNotes(prev => new Map(prev).set(noteId, 'adding'));

    try {
      console.log('useNotes.addNote: Calling conversationManager.addNote (parallel with animation)');
      // Call the actual add note function immediately - animation runs in parallel
      await conversationManager?.addNote(noteId, true); // Enable auto-start conversation
      
      console.log('useNotes.addNote: ConversationManager operation complete, clearing loading state');
      // Clear loading state first
      setLoadingNotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(noteId);
        return newMap;
      });
      
      console.log('useNotes.addNote: Triggering final refresh to sync with manager state');
      // Manual refresh after clearing loading state to ensure sync with manager
      setTimeout(() => {
        console.log('useNotes.addNote: Executing delayed refreshNotes after loading state cleared');
        refreshNotes();
      }, 50); // Small delay to ensure loading state is cleared first
      
    } catch (error) {
      console.error('useNotes.addNote: Error adding note:', error);
      
      // Remove from UI on error
      setActiveNotes(prev => prev.filter(note => note.path !== noteId));
      
      // Clear loading state
      setLoadingNotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(noteId);
        return newMap;
      });
    }
  }, [conversationManager, app.vault, refreshNotes]);

  const removeNote = useCallback(async (noteId: string): Promise<void> => {
    console.log('useNotes.removeNote: Starting with noteId:', noteId);
    
    // Set loading state immediately for visual feedback
    console.log('useNotes.removeNote: Setting loading state for animation');
    setLoadingNotes(prev => {
      const newMap = new Map(prev);
      newMap.set(noteId, 'removing');
      console.log('useNotes.removeNote: Loading state set, current loadingNotes:', Array.from(newMap.entries()));
      return newMap;
    });

    try {
      console.log('useNotes.removeNote: Calling conversationManager.removeNote (parallel with animation)');
      // Call the actual remove note function immediately - animation runs in parallel
      await conversationManager?.removeNote(noteId);
      
      console.log('useNotes.removeNote: ConversationManager operation complete, clearing loading state');
      // Clear loading state first
      setLoadingNotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(noteId);
        console.log('useNotes.removeNote: Loading state cleared');
        return newMap;
      });
      
      console.log('useNotes.removeNote: Triggering final refresh to sync with manager state');
      // Manual refresh after clearing loading state to ensure sync with manager
      setTimeout(() => {
        console.log('useNotes.removeNote: Executing delayed refreshNotes after loading state cleared');
        refreshNotes();
      }, 50); // Small delay to ensure loading state is cleared first
      
    } catch (error) {
      console.error('useNotes.removeNote: Error removing note:', error);
      
      // Clear loading state on error (keep in UI since removal failed)
      setLoadingNotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(noteId);
        return newMap;
      });
    }
  }, [conversationManager, refreshNotes]);

  return {
    /** List of TFile objects currently included in the active conversation context. */
    activeNotes,
    /** Boolean indicating if a search operation is in progress. */
    isLoading,
    /** Error message string if a search operation failed, otherwise null. */
    error,
    /** Function to add the currently active Obsidian file to the conversation context. */
    addCurrentFile,
    /** Function to add a file to the conversation context by its vault path. */
    addFileByPath,
    /** Function to remove a file from the conversation context by its vault path. */
    removeFile,
    /** Function to get the currently active TFile in the workspace. */
    getCurrentFile,
    /** Function to get a list of recently opened TFiles. */
    getRecentFiles,
    /** Function to search markdown files in the vault based on a query string. */
    searchFiles,
    /** Function to directly set the activeNotes state (use with caution). */
    setActiveNotes,
    loadingNotes,
    addNote,
    removeNote,
    refreshNotes
  };
} 