// Import Jest DOM extensions
import '@testing-library/jest-dom';

// Mock the Obsidian API
jest.mock('obsidian', () => ({
  TFile: class TFile {
    constructor(path, basename) {
      this.path = path;
      this.basename = basename;
      this.extension = path.split('.').pop();
    }
  },
  Notice: jest.fn(),
  ItemView: class ItemView {
    constructor(leaf) {
      this.leaf = leaf;
      this.containerEl = {
        children: [
          {},
          {
            empty: jest.fn(),
            addClass: jest.fn(),
            removeClass: jest.fn(),
            createEl: jest.fn().mockReturnValue({
              createEl: jest.fn().mockReturnValue({}),
            }),
          },
        ]
      };
    }
    getViewType() { return 'test-view'; }
    getDisplayText() { return 'Test View'; }
  },
  Plugin: class Plugin {
    registerView() {}
    addRibbonIcon() {}
    addCommand() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
  },
  WorkspaceLeaf: class WorkspaceLeaf {},
  MarkdownView: class MarkdownView {},
  Setting: class Setting {
    constructor(containerEl) {
      this.containerEl = containerEl;
    }
    setName() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addToggle() { return this; }
    addDropdown() { return this; }
    addButton() { return this; }
  },
}));

// Mock the window.sonoriaPlugin global
global.window.sonoriaPlugin = {
  app: {
    workspace: {
      getActiveFile: jest.fn(),
      getLastOpenFiles: jest.fn().mockReturnValue([]),
      on: jest.fn(),
      off: jest.fn(),
    },
    vault: {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn().mockResolvedValue(''),
      adapter: {
        read: jest.fn().mockResolvedValue(''),
        exists: jest.fn().mockResolvedValue(false),
      },
      getMarkdownFiles: jest.fn().mockReturnValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
  },
  settings: {
    openAiModel: 'gpt-3.5-turbo',
    openAiApiKey: 'test-key',
    activeProvider: 'openai',
  },
  conversationManager: {
    currentConversation: null,
    startConversation: jest.fn().mockResolvedValue({}),
    sendMessage: jest.fn().mockResolvedValue({}),
  },
}; 