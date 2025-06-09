// This file uses TypeScript declaration merging to add properties and methods
// to the official 'obsidian' types that are used in the codebase but may
// not be part of the officially documented API.
// Use this approach instead of creating separate 'Extended' interfaces.

import type { TFile, TFolder, DataAdapter, OpenViewState, PaneType } from 'obsidian';

// Ensure this file is treated as a module.
export {};

declare module 'obsidian' {
  interface Workspace {
    // Add properties/methods reported as missing by the linter in noteService.ts
    getActiveFile(): TFile | null;
    getLastOpenFiles(): string[];
    openLinkText(linktext: string, sourcePath: string, newLeaf?: PaneType | boolean, openViewState?: OpenViewState): Promise<void>;

    // Add other necessary Workspace extensions based on the original ExtendedWorkspace
    // getActiveViewOfType<T>(type: any): T | null; // Example if needed
    // iterateAllLeaves(callback: (leaf: any) => any): void; // Example if needed
    // getLeaf(newLeaf?: boolean): any; // Example if needed
    detachLeavesOfType(viewType: string): void;
    // ... and so on
  }

  interface Vault {
    // Add properties/methods reported as missing by the linter in noteService.ts
    cachedRead(file: TFile): Promise<string>;
    createFolder(normalizedPath: string): Promise<TFolder>;

    // Add potentially undocumented or missing properties/methods used in the codebase here.
    // Example: If the structure of 'adapter' is consistently used and needed.
    adapter: DataAdapter; // Assuming DataAdapter interface matches runtime
    
    // Add other necessary Vault extensions based on the original ExtendedVault
    // ...
  }
  
  // Add DataAdapter definition if it's not exported or needs extension
  // interface DataAdapter { ... } 
  // Note: The original ExtendedVault defined adapter structure inline. 
  // It's better to ensure the official DataAdapter covers this, or define
  // the necessary extension properties directly on the interface via merging.
  // For now, assuming the existing `import { DataAdapter } from 'obsidian'` works
  // If not, we'll need to define the missing adapter methods here.

  // Note: We will selectively add members from the old ExtendedWorkspace/ExtendedVault
  // to these declarations as we refactor and confirm they are needed and not
  // already covered by the official types.
} 