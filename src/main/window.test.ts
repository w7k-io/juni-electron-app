// Mock electron BEFORE importing the module under test (window.ts imports it at top level).
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  session: { defaultSession: { webRequest: { onHeadersReceived: jest.fn() } } },
}));

import { CONTENT_SECURITY_POLICY } from './window';

/**
 * Helper: extract the source list of a CSP directive (e.g. "connect-src").
 */
function directiveSources(csp: string, directive: string): string[] {
  const found = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === directive || d.startsWith(`${directive} `));
  if (!found) return [];
  return found.slice(directive.length).trim().split(/\s+/).filter(Boolean);
}

describe('Electron CSP', () => {
  // Sentinel — the Electron CSP duplicates juni-app ResponseHeadersFilter.java and
  // the two drift. The webapp fetches the merged playlist MP4 from download.kagron.app
  // (JUNI-744 "Télécharger"); a missing host here blocks it as "Failed to fetch".
  // DO NOT remove these hosts without removing them from the webapp too.
  it('allows the webapp to fetch the playlist download host (regression: Failed to fetch)', () => {
    expect(directiveSources(CONTENT_SECURITY_POLICY, 'connect-src')).toContain(
      'https://download.kagron.app',
    );
  });

  it('keeps the core prod hosts reachable via connect-src', () => {
    const connect = directiveSources(CONTENT_SECURITY_POLICY, 'connect-src');
    expect(connect).toContain("'self'");
    expect(connect).toContain('https://kagron.app');
    expect(connect).toContain('https://*.blob.core.windows.net');
    expect(connect).toContain('https://media.kagron.app');
  });

  it('blocks framing and plugins (defence in depth)', () => {
    expect(directiveSources(CONTENT_SECURITY_POLICY, 'object-src')).toContain("'none'");
  });
});
