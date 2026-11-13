const assert = require('assert/strict')
const path = require('path')
const serverEntries = {
  router: 'server/router',
  link: 'lib/link',
  head: 'lib/head',
  'page-loader': 'lib/page-loader',
  document: 'server/document'
}

for (const [name, legacyTarget] of Object.entries(serverEntries)) {
  assert.equal(require('@healthline/next/' + name),
    require(path.join(__dirname, 'package/node', legacyTarget)), name + ' must resolve to the server implementation')
}
assert.throws(() => require('@healthline/next/client'), /browser entry/)
for (const privatePath of ['node/lib/head', 'browser/client/router']) {
  assert.throws(() => require('@healthline/next/' + privatePath),
    { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
}
// Tools find the package root through its manifest.
assert.equal(path.dirname(require.resolve('@healthline/next/package.json')), path.join(__dirname, 'package'))
assert.equal(typeof require('@healthline/next/babel'), 'function')
assert.equal(typeof require('@healthline/next').default, 'function')
