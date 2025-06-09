import type {
	App} from 'obsidian';
import {
	PluginSettingTab,
	Setting,
	Notice
} from 'obsidian';
import type NoteChat from "./main";

export interface NoteChatSettings {
	// Essential OpenAI settings only
	openAiApiKey: string;
	llmModel: string;             // OpenAI model for content creation
	
	// Conversation settings
	conversationHistoryDirectory: string;  // Directory where conversation notes are saved
	
	// Internal settings (kept for functionality)
	noteFolderPath: string;       // Folder to save generated notes (internal use)
}

export const DEFAULT_SETTINGS: NoteChatSettings = {
	// API configuration
	openAiApiKey: "",
	llmModel: 'gpt-4o-mini',  // Default to Best Value model
	
	// Conversation settings
	conversationHistoryDirectory: '/NoteChat Conversations',
	
	// Internal settings
	noteFolderPath: '',
};

// Curated OpenAI models with descriptions for content creation
export const OPENAI_MODELS = [
	{
		name: "gpt-4.1",
		displayName: "Ultimate Depth: GPT-4.1",
		description: "When you need rigorous business plans, in-depth technical proposals, or complex code refactoring, choose this. It offers the strongest logic and up to 1M token context—though at the highest cost.",
		isDefault: false
	},
	{
		name: "gpt-4o", 
		displayName: "All-Purpose Accelerator: GPT-4o",
		description: "Handle voice, images, and text in one go; first-token latency < 0.5s, perfect for real-time conversations and creative iterations. Mid-range pricing with a top-tier experience.",
		isDefault: false
	},
	{
		name: "gpt-4o-mini",
		displayName: "Best Value: GPT-4o-mini", 
		description: "Supports the same 128K context, with reasoning performance close to larger models—but at just 1/15 of the cost. Ideal for everyday writing, batch summarization, and lightweight scripting.",
		isDefault: true
	}
];

export class NoteChatSettingTab extends PluginSettingTab {
	plugin: NoteChat;

	constructor(app: App, plugin: NoteChat) {
		super(app, plugin);
		this.plugin = plugin;
	}

		display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Sonoria Settings" });

		// OpenAI Configuration Section
		containerEl.createEl("h3", { text: "OpenAI Configuration" });

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Enter your OpenAI API key for content creation and conversations")
			.addText(text => text
				.setPlaceholder("sk-...")
				.setValue(this.plugin.settings.openAiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openAiApiKey = value;
					await this.plugin.saveSettings();
					if (this.plugin.conversationManager) {
						this.plugin.conversationManager.updateSettings();
					}
					new Notice('OpenAI API Key updated.');
				}));

		new Setting(containerEl)
			.setName("Content Creation Model")
			.setDesc("Select the OpenAI model for content creation and conversations")
			.addButton(button => {
				const currentModel = OPENAI_MODELS.find(m => m.name === this.plugin.settings.llmModel);
				
				// Create a custom dropdown-like button that shows current selection
				button
					.setButtonText(currentModel?.displayName || "Select Model")
					.setClass("notechat-model-selector")
					.onClick(() => {
						// Create and show custom dropdown menu
						this.showModelSelector(button.buttonEl);
					});
				
				// Set initial tooltip for current selection
				if (currentModel) {
					button.buttonEl.title = currentModel.description;
				}
				
				return button;
			});

		// Add some custom styling for the model selector
		const style = document.createElement('style');
		style.textContent = `
			.notechat-model-selector {
				width: 100%;
				text-align: left;
				justify-content: space-between;
			}
			.notechat-model-selector:after {
				content: "▼";
				font-size: 0.8em;
				opacity: 0.6;
				margin-left: auto;
			}
			.notechat-model-menu {
				position: fixed;
				background: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
				box-shadow: var(--shadow-l);
				z-index: 100;
				min-width: 200px;
				max-width: 400px;
			}
			.notechat-model-option {
				padding: 8px 12px;
				cursor: pointer;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			.notechat-model-option:last-child {
				border-bottom: none;
			}
			.notechat-model-option:hover {
				background: var(--background-modifier-hover);
			}
			.notechat-model-option.selected {
				background: var(--background-modifier-active);
			}
			.notechat-model-name {
				font-weight: 500;
				margin-bottom: 4px;
			}
			.notechat-model-desc {
				font-size: 0.9em;
				opacity: 0.8;
				line-height: 1.3;
			}
		`;
		containerEl.appendChild(style);

		// Add informational note about TTS/STT
		const infoEl = containerEl.createEl("div", { 
			cls: "setting-item-description",
			text: "ℹ️ TTS and STT models are preset and optimized for best performance" 
		});
		infoEl.style.marginTop = "8px";
		infoEl.style.color = "var(--text-muted)";
		infoEl.style.fontSize = "0.9em";

		// Conversation Settings Section
		containerEl.createEl("h3", { text: "Conversation Settings" });

		new Setting(containerEl)
			.setName("Conversation History Directory")
			.setDesc("Directory where conversation notes will be saved (use / for vault root)")
			.addText(text => text
				.setPlaceholder("/NoteChat Conversations")
				.setValue(this.plugin.settings.conversationHistoryDirectory)
				.onChange(async (value) => {
					this.plugin.settings.conversationHistoryDirectory = value;
					await this.plugin.saveSettings();
				}));
	}

	showModelSelector(buttonEl: HTMLElement): void {
		// Remove any existing menu
		const existingMenu = document.querySelector('.notechat-model-menu');
		if (existingMenu) {
			existingMenu.remove();
			return; // Toggle behavior - close if already open
		}

		// Create menu container
		const menu = document.createElement('div');
		menu.className = 'notechat-model-menu';
		
		// Position menu below the button using fixed positioning
		const buttonRect = buttonEl.getBoundingClientRect();
		
		menu.style.position = 'fixed';
		menu.style.top = `${buttonRect.bottom + 5}px`;
		menu.style.left = `${buttonRect.left}px`;
		menu.style.width = `${buttonRect.width}px`;

		// Add options
		OPENAI_MODELS.forEach(model => {
			const option = document.createElement('div');
			option.className = 'notechat-model-option';
			
			// Mark current selection
			if (model.name === this.plugin.settings.llmModel) {
				option.classList.add('selected');
			}
			
			const nameEl = document.createElement('div');
			nameEl.className = 'notechat-model-name';
			nameEl.textContent = model.displayName;
			
			const descEl = document.createElement('div');
			descEl.className = 'notechat-model-desc';
			descEl.textContent = model.description;
			
			option.appendChild(nameEl);
			option.appendChild(descEl);
			
			// Handle selection
			option.addEventListener('click', async () => {
				// Update settings
				this.plugin.settings.llmModel = model.name;
				await this.plugin.saveSettings();
				
				// Update button text and tooltip
				const button = buttonEl as HTMLButtonElement;
				button.textContent = model.displayName;
				button.title = model.description;
				
				// **CRITICAL FIX**: Reinitialize AI client with new model
				console.log(`NoteChat Settings: Updating model to: ${model.name}`);
				await this.plugin.initializeAIClient();
				
				// Update conversation manager with new AI client
				if (this.plugin.conversationManager && this.plugin.aiClient) {
					this.plugin.conversationManager.setAIClient(this.plugin.aiClient);
					console.log(`NoteChat Settings: ConversationManager updated with new AI client using model: ${model.name}`);
				}
				
				// **NEW**: Update the assistant's model to match the new setting
				if (this.plugin.openAIService) {
					const assistantUpdateSuccess = await this.plugin.openAIService.updateAssistantModel(model.name);
					if (assistantUpdateSuccess) {
						console.log(`NoteChat Settings: Assistant model successfully updated to: ${model.name}`);
					} else {
						console.warn(`NoteChat Settings: Failed to update assistant model to: ${model.name}`);
					}
				}
				
				// Show confirmation notice
				new Notice(`Model updated to: ${model.displayName}`);
				
				// Close menu
				menu.remove();
			});
			
			menu.appendChild(option);
		});

		// **FIXED**: Add menu to document body instead of container to avoid layout interference
		document.body.appendChild(menu);

		// **FIXED**: Improved click-outside-to-close that doesn't interfere with modal
		const closeMenu = (event: MouseEvent) => {
			const target = event.target as Node;
			
			// Don't close if clicking inside the menu or button
			if (menu.contains(target) || buttonEl.contains(target)) {
				return;
			}
			
			// Close the menu and clean up
			menu.remove();
			document.removeEventListener('click', closeMenu);
		};
		
		// **IMPROVED**: Add listener with passive option and immediate setup
		document.addEventListener('click', closeMenu, { passive: true });
		
		// Clean up listener when menu is removed (fallback)
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
					Array.from(mutation.removedNodes).forEach((node) => {
						if (node === menu) {
							document.removeEventListener('click', closeMenu);
							observer.disconnect();
						}
					});
				}
			});
		});
		observer.observe(document.body, { childList: true });
	}
} 