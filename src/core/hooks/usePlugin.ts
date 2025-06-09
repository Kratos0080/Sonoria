// import { useState, useEffect } from 'react';
// import { useContext } from 'react';
// import { PluginContext } from '../context/PluginContext';
import type NoteChatPlugin from '../../main';

/**
 * Custom hook to access the NoteChatPlugin instance.
 * Ensures the plugin instance is available before returning it.
 */
export const usePlugin = (): NoteChatPlugin => {
  // Use state to potentially handle asynchronous loading if needed,
  // but for now, directly access the global instance.
  const pluginInstance = window.sonoriaPlugin;

  // useEffect(() => {
  //   if (!pluginInstance) {
  //     console.warn('usePlugin: Plugin instance not found immediately.');
  //     // Optionally implement a retry or wait mechanism if plugin loads async relative to UI
  //   }
  // }, [pluginInstance]);

  if (!pluginInstance) {
    // This should ideally not happen if the hook is used after plugin onload
    console.error('CRITICAL: usePlugin hook used before NoteChatPlugin was initialized on window!');
    // Returning null or throwing an error are options, but throwing might crash React.
    // Returning null requires consumers to handle the null case.
    // For now, let's throw to indicate a critical issue.
    throw new Error('NoteChatPlugin instance not available when usePlugin was called.');
  }

  return pluginInstance;
}; 