// Shipped code uses no Vite-only API and reads no build manifest outside a
// VITE-MIGRATION( comment block: rendering must not depend on the bundler.

const fs = require('fs')
const path = require('path')

const packageRoot = path.join(__dirname, '..')
const publishedFiles = require('./published-files')
const banned = /import\.meta|\bvite\b|manifest\.json/i

const withoutMarkers = (source) => {
  let inMarker = false
  return source.split('\n').map((line) => {
    if (!line.trimStart().startsWith('//')) inMarker = false
    const marker = line.indexOf('VITE-MIGRATION(')
    if (marker !== -1) {
      inMarker = true
      return line.slice(0, marker)
    }
    return inMarker ? '' : line
  })
}

it('uses no import.meta and names no Vite path or manifest.json outside VITE-MIGRATION( markers', () => {
  const found = publishedFiles().flatMap((file) => {
    const name = path.relative(packageRoot, file)
    return withoutMarkers(fs.readFileSync(file, 'utf8'))
      .map((line, index) => banned.test(line) ? `${name}:${index + 1}: ${line.trim()}` : null)
      .filter(Boolean)
  })

  expect(found).toEqual([])
})
