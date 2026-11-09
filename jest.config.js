// Jest configuration for this package. It adds no Babel configuration file:
// the preset is referenced inline.

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

module.exports = {
  rootDir: __dirname,
  projects: [
    {
      displayName: 'node',
      rootDir: __dirname,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.test.js'],
      testPathIgnorePatterns: ['\\.browser\\.test\\.js$', '/test/packed-manifest\\.test\\.js$'],
      transform
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
      transform
    }
  ]
}
