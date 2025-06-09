// Mock for Obsidian API
module.exports = {
  Plugin: jest.fn().mockImplementation(() => ({
    addRibbonIcon: jest.fn(),
    addCommand: jest.fn(),
    addSettingTab: jest.fn(),
    saveData: jest.fn(),
    loadData: jest.fn().mockResolvedValue({}),
    registerEvent: jest.fn()
  })),
  
  App: jest.fn().mockImplementation(() => ({
    workspace: {
      getActiveViewOfType: jest.fn(),
      onLayoutReady: jest.fn(),
      on: jest.fn()
    },
    vault: {
      create: jest.fn().mockResolvedValue({}),
      createFolder: jest.fn().mockResolvedValue({}),
      read: jest.fn().mockResolvedValue(''),
      delete: jest.fn().mockResolvedValue({})
    }
  })),
  
  MarkdownView: jest.fn().mockImplementation(() => ({
    getViewData: jest.fn().mockReturnValue('Test note content'),
    file: {
      path: 'test-note.md'
    }
  })),
  
  Modal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    close: jest.fn(),
    contentEl: {
      createDiv: jest.fn().mockReturnValue({
        addClass: jest.fn(),
        createEl: jest.fn(),
        appendChild: jest.fn(),
        empty: jest.fn()
      }),
      empty: jest.fn(),
      addClass: jest.fn()
    }
  })),
  
  PluginSettingTab: jest.fn().mockImplementation(() => ({
    display: jest.fn(),
    containerEl: {
      empty: jest.fn(),
      createEl: jest.fn(),
      createDiv: jest.fn().mockReturnValue({
        addClass: jest.fn(),
        createEl: jest.fn()
      })
    }
  })),
  
  Setting: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    addText: jest.fn().mockReturnValue({
      setPlaceholder: jest.fn().mockReturnThis(),
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis()
    }),
    addDropdown: jest.fn().mockReturnValue({
      addOption: jest.fn().mockReturnThis(),
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis()
    }),
    addToggle: jest.fn().mockReturnValue({
      setValue: jest.fn().mockReturnThis(),
      onChange: jest.fn().mockReturnThis()
    }),
    addButton: jest.fn().mockReturnValue({
      setButtonText: jest.fn().mockReturnThis(),
      onClick: jest.fn().mockReturnThis()
    })
  })),
  
  Notice: jest.fn(),
  
  TFile: jest.fn().mockImplementation((path) => ({
    path: path || 'test-file.md',
    name: path ? path.split('/').pop() : 'test-file.md'
  }))
}; 