// This file is intentionally left empty initially.
// It will be used for declaration merging to augment Obsidian types
// based on specific needs identified during type checking.

declare module 'obsidian' {
    // Example: If an undocumented property is needed
    // interface App {
    //     undocumentedProperty?: any;
    // }
}

// This file is intentionally kept minimal for the initial type check.
// It will be populated in Phase 5 based on specific type errors encountered.
export {};

// This file can be used to declare additional types
// or augment existing types from the 'obsidian' module.

// Example: Augmenting the App interface
/*
declare module 'obsidian' {
  interface App {
    someCustomProperty?: string;
  }
}
*/

// Ensure file is treated as a module
export {};

// Declaration merging for Obsidian API
// This file extends the official obsidian types with undocumented APIs needed by NoteChat

import 'obsidian';
import type { PaneType, OpenViewState, TFile, TFolder, DataAdapter } from 'obsidian'; // Add TFile, TFolder, and DataAdapter imports

declare module 'obsidian' {
  // Define ViewState if missing from base types (can be refined later)
  // type ViewState = any; // REMOVED - Seems to exist in base types now

  // Extend the Workspace interface with undocumented methods
  interface Workspace {
    // Get all workspace leaves of a specific type
    // Observed in Obsidian v1.5.x
    getLeavesOfType(type: string): WorkspaceLeaf[];
    
    // Get a leaf from the right side
    // Observed in Obsidian v1.5.x
    getRightLeaf(collapsed: boolean): WorkspaceLeaf | null;
    
    // Get a leaf from the left side
    // Observed in Obsidian v1.5.x
    getLeftLeaf(collapsed: boolean): WorkspaceLeaf | null;
    
    // Reveal a leaf in the UI
    // Observed in Obsidian v1.5.x
    revealLeaf(leaf: WorkspaceLeaf): void;
    
    // Get recently opened files
    // Observed in Obsidian v1.5.x
    getLastOpenFiles(): string[];
    // Merged from obsidian-extensions.d.ts
    getActiveFile(): TFile | null;
    openLinkText(linktext: string, sourcePath: string, newLeaf?: PaneType | boolean, openViewState?: OpenViewState): Promise<void>;
    detachLeavesOfType(viewType: string): void;
  }
  
  // Extend the WorkspaceLeaf interface
  interface WorkspaceLeaf {
    // Set the view state of the leaf
    // Observed in Obsidian v1.5.x
    setViewState(viewState: ViewState, eState?: unknown): Promise<void>;
  }
  
  // Extend the Editor interface
  interface Editor {
    // Remove potentially redundant overload
    // getValue(): string;
  }
  
  // Extend MarkdownRenderer namespace
  // namespace MarkdownRenderer { // REMOVED - renderMarkdown seems to exist in base types now
  //   function renderMarkdown(markdown: string, el: HTMLElement, sourcePath: string, component: any): Promise<void>;
  // }
  
  // Augment ItemView with missing/potentially mis-typed properties
  interface ItemView {
    containerEl: HTMLElement;
    leaf: WorkspaceLeaf; // Add potentially missing leaf property
  }

  // Additional properties and methods for the Obsidian API
  
  // EventRef is an empty interface in Obsidian API
  export interface EventRef {}

  // FileStats is an empty interface in Obsidian API
  export interface FileStats {}
  
  // Moved CacheItem inside module declaration
  export interface CacheItem {
    leaf: WorkspaceLeaf; 
  }

  // Merged from obsidian-extensions.d.ts
  interface Vault {
    cachedRead(file: TFile): Promise<string>;
    createFolder(normalizedPath: string): Promise<TFolder>;
    adapter: DataAdapter;
  }
} // End declare module 'obsidian'

// Define the structure of the plugin settings
// export interface NoteChatSettings { /* ... */ } // Define in settings.ts instead

// Remove unused empty interface
// interface ExtendedWorkspace {}

// Add other necessary type declarations below 

// export interface CacheItem { // Moved inside module
//   leaf: WorkspaceLeaf; 
// } 