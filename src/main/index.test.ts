/**
 * JUNI-720: ensures the Touch ID handlers are registered alongside the
 * keychain ones in the main process bootstrap.
 */
import fs from 'fs';
import path from 'path';

describe('main/index.ts — Touch ID handlers wiring', () => {
    const file = path.resolve(__dirname, 'index.ts');
    const source = fs.readFileSync(file, 'utf8');

    it('imports setupTouchIdHandlers', () => {
        expect(source).toMatch(/setupTouchIdHandlers/);
        expect(source).toMatch(/from ['"]\.\/ipc\/touchid-handlers['"]/);
    });

    it('calls setupTouchIdHandlers() during app ready', () => {
        expect(source).toMatch(/setupTouchIdHandlers\(\)/);
    });
});
