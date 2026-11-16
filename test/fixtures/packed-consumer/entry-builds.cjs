// Checks which build each public entry resolves to in the unpacked tarball.
// The pack test runs it twice: plainly, as Node and the server build resolve,
// and with --conditions=browser, as browser bundlers resolve.
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')

const packageDir = fs.realpathSync(path.join(__dirname, 'package'))
const { exports: entries } = require(path.join(packageDir, 'package.json'))
const asBrowser = process.execArgv.includes('--conditions=browser')

// Frontend's browser bundles import these, so each needs a browser build.
// A new entry with browser code belongs here and needs a `browser` condition.
const browserEntries = ['./router', './page-loader', './client']

assert.deepEqual(
  Object.keys(entries).filter(name => entries[name].browser), browserEntries,
  'the entries with a `browser` condition must match browserEntries in entry-builds.cjs')

for (const name of Object.keys(entries)) {
  const resolved = path.relative(packageDir, require.resolve('@healthline/next' + name.slice(1)))
  const expectBrowser = asBrowser && browserEntries.includes(name)
  assert.equal(resolved.startsWith('browser' + path.sep), expectBrowser,
    `${name} resolved to ${resolved}; expected ${expectBrowser ? 'a browser/ file' : 'a file outside browser/'}`)
}

if (!asBrowser) {
  // The client entry has no Node build.
  assert.throws(() => require('@healthline/next/client'), /browser entry/)
  // Files the export map does not list stay private, even though they ship.
  for (const privatePath of ['node/server/router', 'browser/client/router']) {
    assert.throws(() => require('@healthline/next/' + privatePath), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
  }
}
