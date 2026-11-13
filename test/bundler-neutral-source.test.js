// Shipped source names neither Vite nor a manifest outside a VITE-MIGRATION(
// comment block.

const fs = require('fs')
const path = require('path')

const packageRoot = path.join(__dirname, '..')
const publishedFiles = require('./published-files')
const banned = /vite|manifest/i

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

it('names neither Vite nor a manifest outside VITE-MIGRATION( markers', () => {
  const found = publishedFiles().flatMap((file) => {
    const name = path.relative(packageRoot, file)
    return withoutMarkers(fs.readFileSync(file, 'utf8'))
      .map((line, index) => banned.test(line) ? `${name}:${index + 1}: ${line.trim()}` : null)
      .filter(Boolean)
  })

  expect(found).toEqual([])
})
