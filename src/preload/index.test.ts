/**
 * JUNI-720: ensures the preload bridge exposes touchIdAvailable + promptTouchId.
 */
import fs from 'fs';
import path from 'path';

describe('preload — Touch ID bridge', () => {
    const file = path.resolve(__dirname, 'index.ts');
    const source = fs.readFileSync(file, 'utf8');

    it('exposes touchIdAvailable on window.electronAPI', () => {
        expect(source).toMatch(/touchIdAvailable/);
        expect(source).toMatch(/touchid:available/);
    });

    it('exposes promptTouchId on window.electronAPI', () => {
        expect(source).toMatch(/promptTouchId/);
        expect(source).toMatch(/touchid:prompt/);
    });
});

describe('preload — HLS cache bridge (JUNI-706)', () => {
    const file = path.resolve(__dirname, 'index.ts');
    const source = fs.readFileSync(file, 'utf8');

    it('exposes cache namespace on window.electronAPI', () => {
        expect(source).toMatch(/const\s+cache\s*=/);
        expect(source).toMatch(/platform:\s*process\.platform,\s*cache,/);
    });

    it('wires every cache:* IPC channel', () => {
        for (const channel of [
            'cache:get',
            'cache:put',
            'cache:get-stats',
            'cache:get-config',
            'cache:set-config',
            'cache:purge',
            'cache:drain-metrics',
        ]) {
            expect(source).toContain(channel);
        }
    });
});
