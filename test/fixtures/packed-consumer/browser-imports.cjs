const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')

// Run with --conditions=browser, the condition browser bundlers set. Only the
// resolved paths are checked: loading browser files in Node would throw.
const browserTargets = {
  router: 'browser/client/router.js',
  link: 'browser/lib/link.js',
  head: 'browser/lib/head.js',
  'page-loader': 'browser/lib/page-loader.js',
  client: 'browser/client/index.js'
}

const packageDir = fs.realpathSync(path.join(__dirname, 'package'))
for (const [name, target] of Object.entries(browserTargets)) {
  assert.equal(require.resolve('@healthline/next/' + name), path.join(packageDir, target),
    name + ' must resolve to the browser build')
}
