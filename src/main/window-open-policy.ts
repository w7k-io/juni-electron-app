/**
 * JUNI-1231 — window.open policy for the wrapper.
 *
 * The webapp's detached sequence panel (double-screen workspace) opens a
 * same-origin pop-up on this exact route. It is the ONLY window.open the
 * wrapper allows; every other new-window request keeps the historical
 * behaviour (download or deny). Zero business logic here: pure URL routing.
 */

/** Origins the wrapper considers "the app" (kept in sync with will-navigate). */
export const ALLOWED_APP_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://kagron.app',
  'https://juni.w7k.app',
];

/** Route served by the webapp for the detached editing panel (JUNI-1235). */
export const DETACHED_PANEL_PATH = '/review/detached-panel';

export function isDetachedPanelUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return ALLOWED_APP_ORIGINS.includes(parsed.origin) && parsed.pathname === DETACHED_PANEL_PATH;
}
