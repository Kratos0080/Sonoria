import type { App } from 'obsidian';

// Store the app instance globally
let appInstance: App;

/**
 * Set the global app instance
 * This should be called when the plugin loads
 */
export function setAppInstance(app: App): void {
  appInstance = app;
  console.log('App instance set in global utility');
}

/**
 * Get the global app instance
 * This provides access to the Obsidian API throughout the codebase
 */
export function getAppInstance(): App {
  if (!appInstance) {
    console.error('App instance not set! Make sure setAppInstance was called during plugin load.');
    throw new Error('App instance not available');
  }
  return appInstance;
} 