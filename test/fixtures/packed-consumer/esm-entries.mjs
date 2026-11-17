// Node loads an entry as native ESM when the importer is ESM, as the Vite
// server build is. A CommonJS file's `default` export does not become the ESM
// default by itself, so each entry with one needs a wrapper in esm/. This
// checks that every such entry has a wrapper and that the wrapper matches.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
// Static, so a missing export fails at link time, as it would for a consumer.
import { events } from '@healthline/next/router'

const require = createRequire(import.meta.url)
const { exports: entries } = JSON.parse(readFileSync(new URL('./package/package.json', import.meta.url), 'utf8'))

for (const [name, entry] of Object.entries(entries)) {
  // The Babel preset and package.json are plain files; the client has no Node build.
  if (typeof entry === 'string' || name === './client') continue

  const specifier = '@healthline/next' + name.slice(1)
  const required = require(specifier)
  const imported = await import(specifier)

  if (Object.hasOwn(required, 'default')) {
    assert.equal(typeof entry.import, 'string', `${name} has a default export, so it needs an esm/ wrapper and an \`import\` condition`)
    assert.equal(imported.default, required.default, `${specifier} default export`)
  }
  const namesOf = module => Object.keys(module).filter(key => key !== 'default' && key !== '__esModule' && key !== 'module.exports')
  assert.deepEqual(namesOf(imported).sort(), namesOf(required).sort(), `${specifier}: import and require must export the same names`)
  for (const key of namesOf(required)) {
    assert.equal(imported[key], required[key], `${specifier} export ${key}`)
  }
}
assert.equal(typeof events.on, 'function')
