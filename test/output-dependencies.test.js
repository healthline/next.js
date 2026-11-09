// The published files import packages the sources never name: Babel's
// transform-runtime rewrites helpers into `@babel/runtime/helpers/*`, which a
// consumer resolves from its own node_modules. In this repository hoisting
// resolves them whichever list declares them, so a declaration moved back to
// devDependencies breaks consumers and nothing else.
//
// One claim, made without an install: every bare package specifier in the
// published files is declared in dependencies or peerDependencies at a range
// the installed version satisfies. It is not a dependency linter. Relative
// specifiers, Node builtins and the package's own name are not
// consumer-resolved, so they are skipped. The published files are the whole
// `files` list, because that list is the tarball.

const fs = require('fs')
const path = require('path')
const { builtinModules } = require('module')
const semver = require('semver')

const packageRoot = path.join(__dirname, '..')
const manifest = require('../package.json')

// Every path the tarball carries, read off `files` with the leading slash
// that anchors each entry stripped: '/bin' -> 'bin'.
const publishedEntries = manifest.files.map((entry) => entry.replace(/^\//, ''))

// Written by `yarn build:package` and gitignored, so they are the only
// published entries a checkout can legitimately lack.
const outputDirectories = ['node', 'browser']

const builtins = new Set(builtinModules)

// Known undeclared specifiers. @healthline/six-million is only in
// devDependencies; whether to declare it, make its requirers unreachable, or
// record it as consumer-supplied is an open decision.
const exemptions = new Set([
  '@healthline/six-million'
])

// One pattern per specifier shape the published files contain. They have no
// `import(...)` and no template-literal specifier.
const specifierPatterns = [
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\.resolve\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g
]

// Extensionless files count, so bin/next-build is swept. `.mjs` and `.cjs`
// are not matched: add them when a published file uses either.
const isJavaScript = (name) => name.endsWith('.js') || !name.includes('.')

const javascriptFilesUnder = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) return javascriptFilesUnder(full)
      return entry.isFile() && isJavaScript(entry.name) ? [full] : []
    })

// A published entry is a directory to walk or a single file to read.
const javascriptFilesIn = (entry) => {
  const full = path.join(packageRoot, entry)

  if (!fs.existsSync(full)) {
    throw new Error(
      `${path.basename(__filename)} sweeps every entry of \`files\` in ` +
        `package.json, and the entry \`${entry}\` is not in this checkout ` +
        `(${full}). Only ${outputDirectories.join(' and ')} may ` +
        'legitimately be absent, because `yarn build:package` writes them ' +
        'and they are gitignored; run `yarn build`. Any other missing entry ' +
        'is a broken checkout or a `files` list naming something that no ' +
        'longer exists.'
    )
  }

  if (fs.statSync(full).isDirectory()) return javascriptFilesUnder(full)
  return isJavaScript(entry) ? [full] : []
}

// '@babel/runtime/helpers/x' -> '@babel/runtime'; 'react-dom/server' -> 'react-dom'
const packageNameOf = (specifier) => {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
}

const collectPackageNames = (files) => {
  const names = new Set()

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')

    for (const pattern of specifierPatterns) {
      for (const [, specifier] of source.matchAll(pattern)) {
        if (specifier.startsWith('.') || specifier.startsWith('/')) continue

        const name = packageNameOf(specifier.replace(/^node:/, ''))
        if (builtins.has(name) || name === manifest.name) continue
        if (exemptions.has(name)) continue

        names.add(name)
      }
    }
  }

  return [...names].sort()
}

const builtTreesArePresent = outputDirectories.every((directory) =>
  fs.existsSync(path.join(packageRoot, directory))
)

// Skipped when the built trees are absent, because a fresh clone has neither
// until `yarn build` runs. CI builds before it tests, so there it fails. The
// sweep is all-or-nothing: a partial surface would miss specifiers.
if (process.env.CI && !builtTreesArePresent) {
  throw new Error(
    `${path.basename(__filename)} needs ${outputDirectories.join(' and ')}, ` +
      'and CI runs `yarn build` before the tests, so their absence is a failure here'
  )
}

const describeSurface = builtTreesArePresent ? describe : describe.skip

describeSurface(
  'every bare specifier in the published surface (skipped when node/ and browser/ are absent: run yarn build)',
  () => {
    // Jest evaluates a skipped describe's body, so the guard is repeated.
    const names = builtTreesArePresent
      ? collectPackageNames(publishedEntries.flatMap(javascriptFilesIn))
      : []

    it('is a specifier the sweep actually found', () => {
      // A sweep that matched nothing would pass every claim below silently.
      expect(names.length).toBeGreaterThan(0)
    })

    it('is declared for consumers at a range the installed version satisfies', () => {
      const undeclared = []
      const unsatisfied = []

      for (const name of names) {
        const range =
          (manifest.dependencies && manifest.dependencies[name]) ||
          (manifest.peerDependencies && manifest.peerDependencies[name])

        if (!range) {
          undeclared.push(name)
          continue
        }

        const installedManifest = path.join(
          packageRoot,
          'node_modules',
          name,
          'package.json'
        )
        if (!fs.existsSync(installedManifest)) continue

        const { version } = JSON.parse(fs.readFileSync(installedManifest, 'utf8'))
        if (!semver.satisfies(version, range)) {
          unsatisfied.push(`${name}@${version} does not satisfy ${range}`)
        }
      }

      expect({ undeclared, unsatisfied }).toEqual({
        undeclared: [],
        unsatisfied: []
      })
    })
  }
)
