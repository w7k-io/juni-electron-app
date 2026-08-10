/**
 * JUNI-1231 — the detached sequence panel (double screen) is the ONLY
 * window.open the wrapper allows. Everything else stays denied/downloaded.
 */
import { ALLOWED_APP_ORIGINS, isDetachedPanelUrl } from './window-open-policy';

describe('isDetachedPanelUrl', () => {
    it.each([
        'https://kagron.app/review/detached-panel',
        'https://juni.w7k.app/review/detached-panel',
        'http://localhost:3000/review/detached-panel',
        'http://localhost:8080/review/detached-panel',
        // Trailing slash added by a router/proxy must not break the feature (Copilot PR #47)
        'https://kagron.app/review/detached-panel/',
    ])('allows the detached panel route on app origins: %s', (url) => {
        expect(isDetachedPanelUrl(url)).toBe(true);
    });

    it('refuses the detached panel path on a foreign origin (no piggybacking)', () => {
        expect(isDetachedPanelUrl('https://evil.example/review/detached-panel')).toBe(false);
    });

    it.each([
        'https://kagron.app/review',
        'https://kagron.app/',
        'https://kagron.app/review/detached-panel/../../settings',
    ])('refuses other paths on app origins: %s', (url) => {
        expect(isDetachedPanelUrl(url)).toBe(false);
    });

    it.each([
        'blob:https://kagron.app/some-id',
        'https://juniproductionsa.blob.core.windows.net/videos/x.mp4',
        'not-a-url',
    ])('refuses non-app URLs and garbage: %s', (url) => {
        expect(isDetachedPanelUrl(url)).toBe(false);
    });

    it('exposes the shared app origins allow-list (single source of truth)', () => {
        expect(ALLOWED_APP_ORIGINS).toEqual(
            expect.arrayContaining(['https://kagron.app', 'http://localhost:3000']),
        );
    });
});
