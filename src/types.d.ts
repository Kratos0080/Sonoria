/* eslint-disable @typescript-eslint/no-empty-object-type */
// Type declarations for modules without built-in TypeScript definitions

declare module 'mini-debounce' {
  export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T, 
    wait?: number
  ): (...args: Parameters<T>) => ReturnType<T>;
}

declare module 'tslib' {
  export function __awaiter(
    thisArg: unknown,
    _arguments: unknown,
    P: (...args: unknown[]) => Promise<unknown>,
    generator: (...args: unknown[]) => Generator<unknown, unknown, unknown>
  ): Promise<unknown>;
  
  export function __generator(
    thisArg: unknown,
    body: (...args: unknown[]) => Generator<unknown, unknown, unknown>
  ): Generator<unknown, unknown, unknown>;
}

export interface CreateNoteOptions {
  content: string;
  path?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface UITheme {
  isDark: boolean;
  accentColor?: string;
}

export interface SwipeEventDetail<_T> {
  direction: 'left' | 'right' | 'up' | 'down';
  deltaX: number;
  deltaY: number;
  velocity: number;
}

export type SomeGenericType<_T> = {
  // ... type definition ...
}; 