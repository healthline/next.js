// The published files import packages the sources never name. Babel's
// transform-runtime rewrites helpers into
// `@babel/runtime/helpers/*` specifiers, and a consumer installing the
// tarball resolves them out of its own node_modules. @babel/runtime was moved
// out of devDependencies for exactly that reason, and the
// pack-and-install fixture that proved it was thrown away afterwards, so the
// declaration could drift back without anything noticing: in this repository
// the helpers resolve through hoisting whatever list they are declared in.
//
// This test is deliberately narrow. It makes one claim -- every bare package
// specifier the published surface carries is declared for consumers at a
// range the installed version satisfies -- and it makes it without an
// install, by reading the published files and package.json. It is not a
// dependency linter: it says nothing about unused declarations, about
// specifiers in the sources, or about transitive resolution.
//
// Relative specifiers, Node builtins and the package's own name are not
// consumer-resolved, so they are skipped.
//
// The surface is the whole `files` list, derived from package.json rather
// than named here, because `files` is the tarball and the tarball is the
// contract. The first version of this
// sweep walked node/ and browser/ only, which left out bin/ and babel.js --
// and `del` and `minimist` are declared in dependencies for bin/next-build
// alone, so the two entries the sweep skipped were the only reason two of
// the declarations existed.

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
// published entries a checkout can legitimately lack. They are named here
// because the skip below has to know which absence is expected; bin/ and
// babel.js are in the checkout and are never a reason to skip.
const outputDirectories = ['node', 'browser']

// Specifiers a bare-specifier sweep finds but a consumer does not resolve
// through this package's declarations.
const builtins = new Set(builtinModules)

// Known uncovered specifiers, each with the open decision about it.
//
// @healthline/six-million is required from four published surfaces, all four
// listed because the sweep now reaches all of them: node/server/webpack.js,
// the HMR client entry under browser/, bin/next-build, and babel.js. Only
// devDependencies declares it. Whether to declare it, make those modules
// unreachable, or record them as consumer-supplied is an open decision.
//
const exemptions = new Set([
  '@healthline/six-million'
])

// One pattern per specifier shape the published surface actually contains
// Measured with rg over node/, browser/, bin/ and babel.js:
// static `require(...)`, `from '...'`, bare `import '...'`, and
// `require.resolve(...)`, which the first three patterns miss and which
// babel.js uses for a bare package name. There is no `import(...)` and no
// template-literal require or import anywhere in the surface, so no pattern
// is written for either; adding one would be a case the repository cannot
// exercise.
const specifierPatterns = [
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\.resolve\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g
]

// bin/next-build carries a `#!/usr/bin/env node` line and no extension, so a
// `.js` filter would have skipped the one file two declarations exist for.
// Measured: the published entries hold 26 `.js` files and that single
// extensionless one, and nothing else. `.mjs` and `.cjs` are not handled
// yet, deliberately: no published entry carries either extension today. That
// changes when the server output becomes ESM.
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
//
// An absent entry used to reach statSync and throw a raw ENOENT from inside
// describe evaluation, which reported 'Test Suites: 1 failed, Tests: 0 total'
// and a stack naming neither the entry nor why its absence is a failure
// rather than the documented skip. Only node/ and browser/
// are gitignored build output; every other entry of `files` is committed, so
// its absence is a broken checkout and the error says which entry and which
// absences are legitimate.
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

// Skipped rather than failed when the built trees are absent: they are
// gitignored build output, so a fresh clone has neither until `yarn build`
// runs. That is the only skip, and never under CI, which builds before it
// tests. bin/ and babel.js are committed, so their absence is a broken
// checkout and belongs in a failure, not a skip -- and the sweep is
// all-or-nothing anyway, because a partial surface would let a declaration
// look unbacked when its only requirer was in the missing part.
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
    // Jest evaluates a skipped describe's body -- measured: with node/ moved
    // aside this sweep threw ENOENT from inside describe.skip and reported a
    // failed suite with zero tests. So the guard is repeated here, and the
    // sweep runs only when there is a whole surface to sweep.
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
