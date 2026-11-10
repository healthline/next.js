// Every package the published files import, apart from the exemptions below,
// is declared in dependencies or peerDependencies, at a range the installed
// version satisfies. Babel adds
// imports the sources never name (`@babel/runtime/helpers/*`), and hoisting
// hides a missing declaration everywhere except a consumer's install.

const fs = require('fs')
const path = require('path')
const { builtinModules } = require('module')
const semver = require('semver')

const packageRoot = path.join(__dirname, '..')
const manifest = require('../package.json')

// Every path the tarball carries, read off `files` with the leading slash
// that anchors each entry stripped: '/bin' -> 'bin'.
const publishedEntries = manifest.files.map((entry) => entry.replace(/^\//, ''))

// The build writes these, so they exist only after `yarn build`.
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
      `The \`files\` entry \`${entry}\` in package.json is not in this ` +
        `checkout (${full}): the checkout is broken, or \`files\` names ` +
        'something that no longer exists.'
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

// Each package name the files import, with the first file that imports it, so
// a failure says where to look.
const collectPackageNames = (files) => {
  const importers = new Map()

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')

    for (const pattern of specifierPatterns) {
      for (const [, specifier] of source.matchAll(pattern)) {
        if (specifier.startsWith('.') || specifier.startsWith('/')) continue

        const name = packageNameOf(specifier.replace(/^node:/, ''))
        if (builtins.has(name) || name === manifest.name) continue
        if (exemptions.has(name)) continue

        if (!importers.has(name)) importers.set(name, path.relative(packageRoot, file))
      }
    }
  }

  return importers
}

const missingOutput = outputDirectories.filter((directory) =>
  !fs.existsSync(path.join(packageRoot, directory))
)
if (missingOutput.length) {
  throw new Error(
    `${path.basename(__filename)} checks the built package, and this checkout ` +
      `has no ${missingOutput.join(' or ')} directory. Run \`yarn build\` first.`
  )
}

describe(
  'every bare specifier in the published surface',
  () => {
    const importers = collectPackageNames(publishedEntries.flatMap(javascriptFilesIn))
    const names = [...importers.keys()].sort()

    it('finds a package through each kind of import: from, require and require.resolve', () => {
      // A pattern that stops matching drops its packages, and the claim below
      // then passes for them silently. @babel/runtime appears only in
      // browser/'s `from` imports, htmlescape only in node/'s `require` calls,
      // and babel-plugin-module-resolver only in babel.js's `require.resolve`.
      // If one of them is removed on purpose, name another package that only
      // that pattern finds.
      expect(names).toEqual(
        expect.arrayContaining(['@babel/runtime', 'htmlescape', 'babel-plugin-module-resolver'])
      )
    })

    it('is declared for consumers at a range the installed version satisfies', () => {
      const undeclared = []
      const unsatisfied = []

      for (const name of names) {
        const range =
          (manifest.dependencies && manifest.dependencies[name]) ||
          (manifest.peerDependencies && manifest.peerDependencies[name])

        if (!range) {
          undeclared.push(`${name}, imported by ${importers.get(name)}`)
          continue
        }

        const installedManifest = path.join(
          packageRoot,
          'node_modules',
          name,
          'package.json'
        )
        // Not installed here, so there is no version to compare.
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
