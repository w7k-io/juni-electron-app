const { MakerZIP } = require('@electron-forge/maker-zip');
const { PublisherGithub } = require('@electron-forge/publisher-github');

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    appBundleId: 'io.w7k.juni',
    name: 'Juni',
    icon: './build/icon',
    appCategoryType: 'public.app-category.sports',
    osxSign: {
      identity: process.env.APPLE_IDENTITY || undefined,
      hardenedRuntime: true,
      entitlements: './build/entitlements.mac.plist',
      'entitlements-inherit': './build/entitlements.mac.plist',
      'gatekeeper-assess': false,
    },
    osxNotarize: process.env.APPLE_ID ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD || process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    } : undefined,
    osxUniversal: {
      x64ArchFiles: '*',
    },
    asar: true,
    ignore: [
      /^\/\.github/,
      /^\/test/,
      /^\/app-under-test/,
      /^\/playwright-report/,
      /^\/test-results/,
      /^\/docs/,
      /^\/\.editorconfig/,
      /\.spec\./,
      /\.test\./,
    ],
  },
  makers: [
    new MakerZIP({}, ['darwin']),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'w7k-io',
        name: 'juni-electron-app',
      },
      prerelease: true,
    }),
  ],
};
