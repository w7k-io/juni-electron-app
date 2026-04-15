/**
 * JUNI-720: Touch ID IPC handlers (macOS only).
 * Verifies registration of the two handlers and platform-aware availability.
 */

const handlers: Record<string, (...args: unknown[]) => unknown> = {};
const canPromptTouchID = jest.fn();
const promptTouchID = jest.fn();

jest.mock('electron', () => ({
    ipcMain: {
        handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
            handlers[channel] = fn;
        },
    },
    systemPreferences: {
        canPromptTouchID: () => canPromptTouchID(),
        promptTouchID: (reason: string) => promptTouchID(reason),
    },
}));

import { setupTouchIdHandlers } from './touchid-handlers';

describe('Touch ID handlers (JUNI-720)', () => {
    beforeEach(() => {
        Object.keys(handlers).forEach(k => delete handlers[k]);
        canPromptTouchID.mockReset();
        promptTouchID.mockReset();
    });

    it('registers touchid:available and touchid:prompt handlers', () => {
        setupTouchIdHandlers();
        expect(handlers['touchid:available']).toBeDefined();
        expect(handlers['touchid:prompt']).toBeDefined();
    });

    it('reports availability only on darwin when the OS supports Touch ID', async () => {
        const original = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
        canPromptTouchID.mockReturnValue(true);

        setupTouchIdHandlers();
        const available = await handlers['touchid:available']({} as never);

        expect(available).toBe(true);
        Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    it('reports unavailable on non-darwin platforms regardless of OS support', async () => {
        const original = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
        canPromptTouchID.mockReturnValue(true);

        setupTouchIdHandlers();
        const available = await handlers['touchid:available']({} as never);

        expect(available).toBe(false);
        Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    it('returns true on a successful prompt (darwin)', async () => {
        const original = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
        promptTouchID.mockResolvedValue(undefined);
        setupTouchIdHandlers();

        const ok = await handlers['touchid:prompt']({} as never, 'unlock Kagron');

        expect(ok).toBe(true);
        expect(promptTouchID).toHaveBeenCalledWith('unlock Kagron');
        Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    it('returns false when the user cancels or fails Touch ID (darwin)', async () => {
        const original = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
        promptTouchID.mockRejectedValue(new Error('cancelled'));
        setupTouchIdHandlers();

        const ok = await handlers['touchid:prompt']({} as never, 'unlock Kagron');

        expect(ok).toBe(false);
        Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    it('returns false on non-darwin without prompting', async () => {
        const original = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
        setupTouchIdHandlers();

        const ok = await handlers['touchid:prompt']({} as never, 'unlock Kagron');

        expect(ok).toBe(false);
        expect(promptTouchID).not.toHaveBeenCalled();
        Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });
});
