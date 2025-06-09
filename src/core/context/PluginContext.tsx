// import React, { createContext, useContext, ReactNode } from 'react';
import React from 'react';
// import { NoteChatPlugin } from '../../main';
import type NoteChatPlugin from '../../main';

// Define the shape of the context data
interface PluginContextType {
  plugin: NoteChatPlugin | null;
  // Add other shared states or functions if needed later
}

// Create the context with a default value
export const PluginContext = React.createContext<PluginContextType>({
  plugin: null,
});

// Removed the PluginProvider component 