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
