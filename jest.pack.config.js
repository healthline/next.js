// `yarn pack` rebuilds node/ and browser/ and rewrites package.json, which the
// other tests read, so the tarball test runs alone, from this config.
const { projects } = require('./jest.config')
const { transform } = projects.find((project) => project.displayName === 'node')

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/packed-manifest.test.js'],
  transform
}
