// Jest configuration for this package.
//
// moduleNameMapper matches the *rewritten* specifier, not `next/*`.
// babel.js rewrites `next/link` to `@healthline/next/node/lib/link` before
// Jest ever resolves it, and that published path cannot self-resolve because
// package.json has no exports field. Since the `node/` and `browser/` build
// outputs mirror the repository root, mapping the published prefixes back to
// <rootDir> restores the in-repo sources for every alias at once. This mapper
// goes away if the package gains an exports field, or if Jest stops using the
// preset.
//
// This adds no Babel configuration file: the
// preset is referenced inline and resolved absolutely so Jest works from any cwd.

const transform = {
  '^.+\\.js$': [
    'babel-jest',
    {
      // Absolute, so the preset resolves no matter what cwd Jest runs from.
      // Jest does not expand <rootDir> inside transform option objects.
      presets: [require.resolve('./babel.js')],
      babelrc: false,
      configFile: false
    }
  ]
}

// The `node/` and `browser/` build trees mirror the repository root.
const inRepoSources = {
  '^@healthline/next/node/(.*)$': '<rootDir>/$1',
  '^@healthline/next/browser/(.*)$': '<rootDir>/$1'
}

module.exports = {
  rootDir: __dirname,
  projects: [
    {
      displayName: 'node',
      rootDir: __dirname,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.test.js'],
      testPathIgnorePatterns: ['\\.browser\\.test\\.js$', '/test/packed-manifest\\.test\\.js$'],
      transform,
      moduleNameMapper: inRepoSources
    },
    {
      // `yarn pack` rebuilds node/ and browser/ and rewrites package.json, so
      // this runs alone, never beside the other projects.
      displayName: 'pack',
      rootDir: __dirname,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/packed-manifest.test.js'],
      transform
    },
    {
      displayName: 'browser',
      rootDir: __dirname,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/test/**/*.browser.test.js'],
      // React 16 only warns on a hydration mismatch, so every browser test
      // fails on that warning. The setup file says why it is project-wide.
      setupFilesAfterEnv: ['<rootDir>/test/setup/fail-on-hydration-warning.js'],
      transform,
      moduleNameMapper: inRepoSources
    }
  ]
}
