import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
// Static, so a missing export fails at link time, as it would for a consumer.
import { events } from '@healthline/next/router'

const require = createRequire(import.meta.url)
const { exports } = JSON.parse(readFileSync(new URL('./package/package.json', import.meta.url), 'utf8'))
// Conditional entries are modules; plain-string entries such as the Babel
// preset and package.json have no import condition.
const serverEntries = Object.entries(exports)
  .filter(([name, entry]) => typeof entry === 'object' && name !== './client')

for (const [name, entry] of serverEntries) {
  assert.equal(typeof entry.import, 'string', name + ' must have a native import entry')
  const specifier = '@healthline/next' + name.slice(1)
  const imported = await import(specifier)
  const required = require(specifier)
  if (Object.hasOwn(required, 'default')) {
    assert.equal(typeof imported.default, 'function', specifier + ' default export')
  }
  for (const key of Object.keys(required).filter(key => key !== '__esModule')) {
    assert(Object.hasOwn(imported, key), specifier + ' missing export ' + key)
    assert.equal(imported[key], required[key], specifier + ' export ' + key)
  }
}
assert.equal(events, undefined)
