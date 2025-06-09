// Import Jest DOM extensions
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import type { Workspace } from 'obsidian';
import type { Notice } from 'obsidian'; // Changed to import type
// Import specific types from React directly
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import 'whatwg-fetch'; // Polyfill for fetch, Request, Response in JSDOM

// Declare the jest global
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test setup global, type is complex and widely understood as 'any' in this context.
declare const jest: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test setup global, type is complex.
declare const global: any;
declare const beforeEach: (...args: unknown[]) => void; // Changed to unknown[]

// Mock global objects that might be needed
Object.defineProperty(global, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }))
});

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: jest.fn().mockImplementation((/* key: string */) => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn().mockImplementation((/* index: number */) => null)
  },
  writable: true
});

// Mock fetch API
global.fetch = jest.fn().mockImplementation(
  (): Promise<{ ok: boolean; json: () => Promise<object>; text: () => Promise<string> }> => {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('')
    });
  }
) as jest.MockedFunction<typeof fetch>; // Typed fetch mock

// Silence console errors during tests
console.error = jest.fn() as jest.MockedFunction<typeof console.error>; // Typed console.error mock

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global declaration is fine, no @ts-expect-error needed
declare global {
  // Remove JSX namespace if not strictly needed or replace with module augmentation
  // namespace JSX {
  //   interface IntrinsicElements {
  //     [elemName: string]: any;
  //   }
  // }

  // Remove React namespace if not strictly needed or replace with module augmentation
  // namespace React {
  //   interface KeyboardEvent<T = Element> {
  //     key: string;
  //     shiftKey: boolean;
  //   }
  // }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- T is part of standard signature, kept for compatibility
    interface KeyboardEvent<T = Element> {
      key: string;
      shiftKey: boolean;
    }
  }
}

// Polyfill TextEncoder/Decoder for Jest environment
global.TextEncoder = TextEncoder;
// Assigning to readonly property
global.TextDecoder = TextDecoder;

// Mock Obsidian specific APIs globally
// Mock App parts needed for tests
const mockApp = {
  vault: {
    // Add necessary vault mocks
    read: jest.fn().mockResolvedValue(''),
    modify: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined),
    getAbstractFileByPath: jest.fn().mockReturnValue(null),
  },
  workspace: { 
    // Add necessary workspace mocks
    getActiveFile: jest.fn().mockReturnValue(null),
    getLeavesOfType: jest.fn().mockReturnValue([]),
    // ... other mocks
  } as Partial<Workspace>,
  // ... other app mocks
};

// Assign mocks to window/global object for accessibility in tests
// Allow assigning to window for testing
global.app = mockApp;

// Mock Notice constructor
global.Notice = jest.fn() as jest.MockedClass<typeof Notice>; // Typed Notice mock

// Mock global Notice if needed (adjust type if necessary)
// var Notice: any; // Remove global var if using jest.fn() below 