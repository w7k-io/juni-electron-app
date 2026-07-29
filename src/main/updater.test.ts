// Mock electron BEFORE importing the module under test: updater.ts reads
// app.getVersion() at module load time to build the feed URL.
jest.mock('electron', () => ({
  autoUpdater: { setFeedURL: jest.fn(), on: jest.fn(), checkForUpdates: jest.fn() },
  dialog: { showMessageBox: jest.fn() },
  app: { isPackaged: false, getVersion: () => '0.0.0-test' },
}));

import { canReceiveUpdates, getMacOsMajorVersion } from './updater';

describe('getMacOsMajorVersion', () => {
  it.each([
    ['12.6.1', 12],
    ['11.7.10', 11],
    ['15.0', 15],
    ['26', 26],
  ])('extracts the major from %s', (version, expected) => {
    expect(getMacOsMajorVersion(version)).toBe(expected);
  });

  it.each(['', 'unknown', 'not-a-version'])('returns null for unparseable %p', (version) => {
    expect(getMacOsMajorVersion(version)).toBeNull();
  });
});

describe('canReceiveUpdates', () => {
  // Electron 43 requires macOS 13 (Ventura) — one notch above the macOS 12 that
  // Electron 38 introduced. Shipping an update to an older system leaves the
  // user with an app that no longer launches, and Squirrel.Mac does not filter
  // releases by OS version.
  it.each(['12.6.1', '12.0', '11.7.10', '10.15.7'])('blocks updates on macOS %s', (version) => {
    expect(canReceiveUpdates('darwin', version)).toBe(false);
  });

  it.each(['13.0', '13.6.4', '15.2', '26.1'])('allows updates on macOS %s', (version) => {
    expect(canReceiveUpdates('darwin', version)).toBe(true);
  });

  it('never blocks non-darwin platforms', () => {
    expect(canReceiveUpdates('win32', '10.0.19045')).toBe(true);
    expect(canReceiveUpdates('linux', '6.8.0')).toBe(true);
  });

  it('allows updates when the version cannot be parsed', () => {
    // Failing to parse must never strand a user on an old build.
    expect(canReceiveUpdates('darwin', 'unknown')).toBe(true);
  });
});
