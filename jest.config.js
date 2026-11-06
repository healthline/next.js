// Jest configuration for this package.
//
// Two things here are not obvious.
//
// First, moduleNameMapper matches the *rewritten* specifier, not `next/*`.
// babel.js rewrites `next/link` to `@healthline/next/node/lib/link` before
// Jest ever resolves it, and that published path cannot self-resolve because
// package.json has no exports field. Since the `node/` and `browser/` build
// outputs mirror the repository root, mapping the published prefixes back to
// <rootDir> restores the in-repo sources for every alias at once. This mapper
// goes away if the package gains an exports field, or if Jest stops using the
// preset.
//
// Second, babel.js computes `isServer = IS_SERVER || isJest`, so under Jest
// the browser branch of its alias table is dead and every alias takes its
// server target. The browser project below therefore re-points the aliases
// whose two variants differ to the client source. Only `next/router` differs
// in a way a test can reach; `next/client` has no server target at all (the
// alias value is `undefined`, which compiles to `require("undefined")`), so
// client-entry tests must import ../client/index relatively instead.
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
      testPathIgnorePatterns: ['\\.browser\\.test\\.js$'],
      transform,
      moduleNameMapper: inRepoSources
    },
    {
      displayName: 'browser',
      rootDir: __dirname,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/test/**/*.browser.test.js'],
      transform,
      moduleNameMapper: {
        // Re-point the aliases whose server and browser targets differ.
        '^@healthline/next/node/server/router$': '<rootDir>/client/router.js',
        ...inRepoSources
      }
    }
  ]
}
