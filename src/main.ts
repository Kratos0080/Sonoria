import type { WorkspaceLeaf, Workspace } from 'obsidian';
import { Notice, Plugin } from 'obsidian';
import type { NoteChatSettings } from '@app/settings';
import { DEFAULT_SETTINGS, NoteChatSettingTab } from '@app/settings';
import { ConversationManager } from '@app/features/chat/store/conversationContext';
import { VIEW_TYPE_SONORIA } from './constants';
import { setAppInstance } from './utils/app';
import { applyDevelopmentSettings } from './utils/devUtils';
import type { AIClient } from './core/api/aiClient';
import { AIClientFactory } from './core/api/aiClientFactory';
import { NoteContextManager } from './utils/noteContextManager';
import { ChatService } from './features/chat/services/chatService';
import { NoteService } from './core/services/noteService';
import { OpenAIService } from './core/services/OpenAIService';
import { StorageService } from './core/services/storageService';
import type { NoteChatView } from './features/chat/components/NoteChatView';
import type { NoteChatPlugin as NoteChatPluginInterface } from './core/types/obsidian';
import { PlaceholderAIClient } from './core/api/PlaceholderAIClient';

// Make the plugin instance globally accessible
declare global {
  interface Window {
    // Use the alias here too if needed, or keep as is if global type matches class structure
    sonoriaPlugin: NoteChatPlugin | null;
  }
}

// Implement the interface
export default class NoteChatPlugin extends Plugin implements NoteChatPluginInterface {
  settings: NoteChatSettings = DEFAULT_SETTINGS;
  conversationManager!: ConversationManager;
  aiClient: AIClient | null = null;
  noteService!: NoteService;
  aiClientFactory!: AIClientFactory;
  noteContextManager!: NoteContextManager;
  chatService!: ChatService;
  openAIService!: OpenAIService;
  private view: NoteChatView | null = null;
  storageService!: StorageService;

  // Correct implementation for the 'events' property
  events = {
    on: (name: string, /* callback: (data: any) => void */): void => {
      console.log(`Mock event listener registered for: ${name}`);
    },
    off: (name: string, /* callback: (data: unknown) => void */): void => {
      console.log(`Mock event listener removed for: ${name}`);
    },
    trigger: (name: string, data: unknown): void => {
      // Placeholder: Implement event triggering logic if needed
      console.warn(`NoteChatPlugin.events.trigger called for: ${name} - Not implemented`, data);
    }
  };

  async onload() {
    console.log('Loading NoteChat Plugin');
    
    // Set the app instance first
    setAppInstance(this.app);
    
    // Initialize core services that don't immediately depend on API keys from loaded settings
    this.storageService = new StorageService(this);
    this.noteService = new NoteService(this.app, this.settings.noteFolderPath);
    this.noteContextManager = new NoteContextManager(this.app);
    
    // AI Client and OpenAIService will be initialized *after* settings are loaded and processed by applyDevelopmentSettings
    this.aiClient = null; 
    // this.openAIService will be initialized after settings load.

    // Initialize ConversationManager - aiClient is null initially, will be set.
    this.conversationManager = new ConversationManager(this, this.aiClient);

    // Initialize ChatService with the plugin instance only
    this.chatService = new ChatService(this);
    this.chatService.initialize();
    
    window.sonoriaPlugin = this;
    
    try {
      // 1. Load settings (this now includes applyDevelopmentSettings)
      await this.loadSettings();
      
      // 2. Initialize AI client with processed settings
      this.initializeAIClient(); 
      
      // 3. Initialize OpenAIService with final processed settings
      // Ensure it's always initialized here after settings are final
      this.openAIService = new OpenAIService(this.settings);
      console.log('NoteChat: OpenAIService initialized in onload after settings processing.');

      // Update assistant instructions to ensure proper response generation after file search
      if (this.openAIService.isAssistantConfigured()) {
        try {
          await this.openAIService.updateAssistantInstructions();
          await this.openAIService.updateAssistantModel(this.settings.llmModel);
          console.log('NoteChat: Assistant instructions and model updated successfully.');
          
          // Check the actual assistant configuration
          await this.openAIService.getAssistantConfiguration();
        } catch (error) {
          console.warn('NoteChat: Failed to update assistant instructions:', error);
        }
      }

      // 4. Update ConversationManager with the initialized AI client
      if (this.conversationManager) {
        this.conversationManager.setAIClient(this.aiClient);
      } else {
        // Fallback, though manager should exist
        console.error("NoteChatPlugin: ConversationManager not found during onload, re-initializing.");
        this.conversationManager = new ConversationManager(this, this.aiClient);
      }
      
      // Add settings tab
      this.addSettingTab(new NoteChatSettingTab(this.app, this));
      
      // 5. Save settings (persists any dev settings for the session & triggers re-init logic in saveSettings if keys differ)
      // This also ensures that if a user changes settings and saves, the flow is consistent.
      await this.saveSettings(); 
      
      new Notice('Sonoria plugin loaded');
    } catch (error) {
      console.error('NoteChatPlugin: CAUGHT ERROR during onload initialization:', error); 
      new Notice('Failed to initialize Sonoria plugin. Check the console for details.');
      this.settings = { ...DEFAULT_SETTINGS }; // Fallback to defaults
      
      // Attempt to re-initialize services with default settings
      this.initializeAIClient(); // Will likely use PlaceholderAIClient
      this.openAIService = new OpenAIService(this.settings); // With default (empty) API keys
      if (this.conversationManager) {
        this.conversationManager.setAIClient(this.aiClient);
      }
    }

    this.app.workspace.onLayoutReady(async () => {
       await this.activateView(false);

      // Re-check/Re-initialize AI services on layout ready with loaded settings
      // This handles cases where settings might be fully available or changed after initial load.
      console.log("NoteChatPlugin: Layout ready. Re-checking AI Client and OpenAIService initialization.");
      try {
        await this.loadSettings(); // Load and apply dev settings again
        
        this.initializeAIClient(); // Re-initialize main AI client

        // Re-initialize OpenAIService based on final settings from loadSettings
        // This ensures it uses the potentially dev-key-injected settings
        this.openAIService = new OpenAIService(this.settings);
        console.log('NoteChat: OpenAIService re-initialized on layoutReady.');

        // Update assistant instructions to ensure proper response generation after file search
        if (this.openAIService.isAssistantConfigured()) {
          try {
            await this.openAIService.updateAssistantInstructions();
            await this.openAIService.updateAssistantModel(this.settings.llmModel);
            console.log('NoteChat: Assistant instructions and model updated on layoutReady.');
            
            // Check the actual assistant configuration
            await this.openAIService.getAssistantConfiguration();
          } catch (error) {
            console.warn('NoteChat: Failed to update assistant instructions on layoutReady:', error);
          }
        }

        if (this.conversationManager) {
           this.conversationManager.setAIClient(this.aiClient);
        } else {
           console.error("NoteChatPlugin: ConversationManager not found during layout ready re-init.");
           this.conversationManager = new ConversationManager(this, this.aiClient);
        }
      } catch (error) {
        console.error("NoteChatPlugin: Failed to re-initialize AI services on layout ready", error);
        new Notice("Failed to re-initialize AI services after layout ready. Please check settings.");
        this.aiClient = new PlaceholderAIClient('Layout ready re-init failed'); // Ensure placeholder
        this.openAIService = new OpenAIService(DEFAULT_SETTINGS); // Fallback
        if (this.conversationManager) {
            this.conversationManager.setAIClient(this.aiClient);
        }
      }
    });
  }

  onunload() {
    console.log('Unloading Sonoria plugin');
    
    // Clean up the global reference
    window.sonoriaPlugin = null;
    
    // Detach any open views when plugin is disabled
    const workspace: Workspace = this.app.workspace;
    workspace.detachLeavesOfType(VIEW_TYPE_SONORIA);

    // Clean up resources, listeners, etc.
    if (this.view) {
       this.view.onClose();
    }
  }

  async loadSettings() {
    try {
      const savedSettings = await this.loadData();
      console.log('NoteChat: Loaded saved settings from disk:', savedSettings ? 'Found' : 'Not found');

      // Merge with defaults first
      let currentSettings: NoteChatSettings = {
        ...DEFAULT_SETTINGS,
        ...(savedSettings || {}) // Ensure savedSettings is not null/undefined
      };
      
      // Apply development settings (this will use DEV keys if user keys are not set in data.json)
      currentSettings = applyDevelopmentSettings(currentSettings);
      this.settings = currentSettings; // Final settings for the session

      // Updated logging for clarity
      console.log('NoteChat: Settings processed. OpenAI model:', this.settings.llmModel);
      if (this.settings.openAiApiKey && this.settings.openAiApiKey.startsWith('sk-')) {
          console.log('NoteChat: OpenAI API key is configured.');
      } else if (this.settings.openAiApiKey) { // Catches dev keys or malformed user keys
          console.log('NoteChat: OpenAI API key is present (could be DEV key or non-standard format).');
      } else {
          console.warn('NoteChat: OpenAI API key is MISSING in final settings for current session.');
      }

    } catch (error) {
      console.error('NoteChat: Error loading settings:', error);
      this.settings = { ...DEFAULT_SETTINGS }; // Fallback to defaults
      // If load fails, subsequent initializations will use default (empty) keys
    }
  }

  async saveSettings() {
    try {
      await this.saveData(this.settings);
      console.log('NoteChat: Settings persisted to disk.');
      
      // Reinitialize the main AI client when settings change
      this.initializeAIClient();
      
      // Update the conversation manager with the new (or placeholder) client
      if (this.conversationManager) {
        this.conversationManager.setAIClient(this.aiClient); 
      }

      // Revised OpenAIService re-initialization logic
      if (this.settings.openAiApiKey) { // If an OpenAI key is configured in current settings
        if (this.openAIService) { // And the service instance already exists
            // Check if the key actually changed compared to what the service instance has
            if (this.settings.openAiApiKey !== this.openAIService.getApiKey()) {
                console.warn('NoteChat: OpenAI API key setting changed. Re-initializing OpenAIService with new key.');
                this.openAIService = new OpenAIService(this.settings);
                
                // Update assistant instructions after re-initialization
                if (this.openAIService.isAssistantConfigured()) {
                  try {
                    await this.openAIService.updateAssistantInstructions();
                    await this.openAIService.updateAssistantModel(this.settings.llmModel);
                    console.log('NoteChat: Assistant instructions and model updated after key change.');
                  } catch (error) {
                    console.warn('NoteChat: Failed to update assistant instructions after key change:', error);
                  }
                }
            } else {
                // Key is the same as what service has, no re-initialization needed for the key itself.
                // However, OpenAIService constructor also takes other settings, so if those changed, one might consider re-init.
                // For now, only key change triggers re-init here.
            }
        } else { // Service doesn't exist, but a key is now present in settings
            console.log('NoteChat: OpenAI API key present in settings and OpenAIService not initialized. Initializing OpenAIService.');
            this.openAIService = new OpenAIService(this.settings);
            
            // Update assistant instructions after initialization
            if (this.openAIService.isAssistantConfigured()) {
              try {
                await this.openAIService.updateAssistantInstructions();
                await this.openAIService.updateAssistantModel(this.settings.llmModel);
                console.log('NoteChat: Assistant instructions and model updated after initialization.');
              } catch (error) {
                console.warn('NoteChat: Failed to update assistant instructions after initialization:', error);
              }
            }
        }
      } else { // No OpenAI API key is configured in current settings
        if (this.openAIService && this.openAIService.getApiKey()) { // Service exists and previously had a key
            console.warn('NoteChat: OpenAI API key removed from settings. Re-initializing OpenAIService with empty key.');
            this.openAIService = new OpenAIService(this.settings); // this.settings.openAiApiKey is now null/empty
        } 
        // If this.openAIService exists but already had no key, or if it doesn't exist and there's no key, do nothing.
      }

    } catch (error) {
      console.error('NoteChat: Error saving settings:', error);
    }
  }
  
  /**
   * Initialize the AI client based on settings
   */
  initializeAIClient() {
    try {
      // Use the AIClientFactory to create the appropriate client
      const factory = AIClientFactory.getInstance();
      // createClientFromSettings will now return PlaceholderAIClient if keys are missing
      this.aiClient = factory.createClientFromSettings(this.settings); 
      
      if (this.aiClient && this.aiClient.provider !== 'placeholder') {
        console.log(`NoteChat: ${this.aiClient.provider} client initialized with ${this.aiClient.model} model`);
      } else if (this.aiClient instanceof PlaceholderAIClient) {
        console.warn(`NoteChat: AI Client is a placeholder. Reason: ${this.aiClient.reason || 'API Key missing'}`);
      } else {
        // This case should ideally not be reached if factory always returns a client or placeholder
        console.error('NoteChat: Failed to initialize AI client (received null from factory unexpectedly)');
        // Fallback to placeholder explicitly if factory somehow returns null
        this.aiClient = new PlaceholderAIClient("Fell back to placeholder due to factory error.");
      }
    } catch (error) {
      console.error('NoteChat: Error initializing AI client:', error);
      // Fallback to placeholder on any error during initialization
      this.aiClient = new PlaceholderAIClient(`Failed to initialize AI client: ${error.message}`);
    }
  }

  /**
   * Initialize the chat service
   */
  initializeChatService() {
    console.log('NoteChat: Initializing ChatService');
    
    // Create and initialize the chat service
    this.chatService = new ChatService(this);
    this.chatService.initialize();
    
    console.log('NoteChat: ChatService initialized successfully');
  }

  /**
   * Public method to activate the chat view
   */
  async openChatView() {
    if (this.chatService) {
      await this.chatService.activateView();
    }
  }

  /**
   * Public method to activate the chat view with a note
   */
  async openChatViewWithNote(notePath: string) {
    if (this.chatService) {
      await this.chatService.activateViewWithNote(notePath);
    }
  }

  /**
   * Activates the NoteChat view, opening it if necessary.
   * Reverted to original logic which might be compatible with the environment.
   * @param focus Whether to focus the view after activating it.
   */
  async activateView(focus: boolean = true) {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_SONORIA);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      // Original logic: Find a suitable leaf (right sidebar preferred, then left)
      leaf = workspace.getRightLeaf(false);
      if (!leaf) {
          leaf = workspace.getLeftLeaf(false);
      }
       if (!leaf) {
           // As a last resort, use the main workspace leaf
           leaf = workspace.getLeaf(true); 
       }
      if (leaf) {
          // Assuming setViewState exists in this version
          await leaf.setViewState({ type: VIEW_TYPE_SONORIA, active: true });
      }
    }

    if (leaf && focus) {
        // Assuming revealLeaf exists in this version
        workspace.revealLeaf(leaf);
    }
  }
}