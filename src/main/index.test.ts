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

describe('main/index.ts — detached panel allow-list (JUNI-1231)', () => {
    const file = path.resolve(__dirname, 'index.ts');
    const source = fs.readFileSync(file, 'utf8');

    it('routes window.open through the shared policy (isDetachedPanelUrl)', () => {
        expect(source).toMatch(/from ['"]\.\/window-open-policy['"]/);
        expect(source).toMatch(/isDetachedPanelUrl\(url\)/);
        // The ONLY allow in the handler is the detached panel one.
        expect(source.match(/action: 'allow'/g)).toHaveLength(1);
    });

    it('keeps a single source of truth for app origins (will-navigate uses the policy list)', () => {
        expect(source).toMatch(/ALLOWED_APP_ORIGINS/);
        // The old inline duplicate list must not survive in will-navigate.
        expect(source).not.toMatch(/const allowedOrigins = \[/);
    });
});
