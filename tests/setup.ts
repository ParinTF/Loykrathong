import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';

expect.extend(matchers);

declare module 'vitest' {
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends TestingLibraryMatchers<R, T> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// Polyfill HTMLDialogElement.showModal / close in jsdom
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
}