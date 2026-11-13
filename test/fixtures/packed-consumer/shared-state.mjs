import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

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
assert.equal((await import('@healthline/next/router')).events, undefined)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const commonHead = require('@healthline/next/head').default
const moduleHead = (await import('@healthline/next/head')).default
for (const [writer, reader, title] of [
  [commonHead, moduleHead, 'CommonJS to ESM'],
  [moduleHead, commonHead, 'ESM to CommonJS']
]) {
  renderToStaticMarkup(React.createElement(writer, null, React.createElement('title', null, title)))
  assert((reader.rewind() || []).some(tag => tag.type === 'title' && tag.props.children === title), title)
}
const commonLoader = require('@healthline/next/page-loader')
const moduleLoader = await import('@healthline/next/page-loader')
for (const [writer, reader, route] of [
  [commonLoader, moduleLoader, '/common-to-module'],
  [moduleLoader, commonLoader, '/module-to-common']
]) {
  const page = () => null
  const waiting = reader.waitForPage(route)
  writer.registerPage(route, () => ({ page }))
  assert.equal(await waiting, page, route + ' registration')
  assert.equal(await reader.waitForPage(route), page, route + ' cache')
}
