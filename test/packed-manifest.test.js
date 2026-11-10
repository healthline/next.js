// Packs the package the way a publish does and reads the real tarball, because
// what it claims exists only there: the files that ship, and the `scripts`
// pinst rewrites between prepack and postpack. Reading package.json, or
// `npm pack --dry-run` (which skips Yarn's pack lifecycle), could not fail.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const packageRoot = path.join(__dirname, '..')
const manifestPath = path.join(packageRoot, 'package.json')

// Outside the checkout, and removed after the suite.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'next-packed-manifest-'))
const tarball = path.join(scratch, 'packed.tgz')

// `yarn pack` mutates the working package.json while it runs, so this is the
// text the run has to give back.
const manifestBefore = fs.readFileSync(manifestPath, 'utf8')

const pack = spawnSync('yarn', ['pack', '--out', tarball], {
  cwd: packageRoot,
  encoding: 'utf8'
})

// The manifest inside the tarball, read without unpacking the rest of it.
const readPackedManifest = () => {
  const extract = spawnSync('tar', ['-xzOf', tarball, 'package/package.json'], {
    encoding: 'utf8'
  })

  if (extract.status !== 0) {
    throw new Error(
      `could not read package/package.json out of ${tarball}: ` +
        `tar exited ${extract.status} ${(extract.stderr || '').trim()}`
    )
  }

  return JSON.parse(extract.stdout)
}

// Every file in the tarball, relative to its `package/` root.
const readPackedFiles = () => {
  const list = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
  if (list.status !== 0) {
    throw new Error(`could not list ${tarball}: tar exited ${list.status}`)
  }
  return new Set(
    list.stdout.split('\n').filter(Boolean).map((file) => file.replace(/^package\//, ''))
  )
}

// The files a consumer loads through the package's own entry points: each
// `bin` command and the Babel preset (`@healthline/next/babel`), what the
// commands require relatively, and each `@healthline/next/...` target the
// preset aliases `next/*` to.
const filesTheEntryPointsLoad = () => {
  const manifest = JSON.parse(manifestBefore)
  const binFiles = Object.values(manifest.bin).map((file) => path.posix.normalize(file))
  const entryFiles = [...binFiles, 'babel.js']

  const required = binFiles.flatMap((file) => {
    const source = fs.readFileSync(path.join(packageRoot, file), 'utf8')
    return [...source.matchAll(/require\(\s*'(\.\.?\/[^']+)'\s*\)/g)]
      .map(([, specifier]) => path.posix.join(path.posix.dirname(file), specifier))
  })

  const babelSource = fs.readFileSync(path.join(packageRoot, 'babel.js'), 'utf8')
  const aliased = [...babelSource.matchAll(new RegExp(`'${manifest.name}/([^']+)'`, 'g'))]
    .map(([, target]) => target)

  return { entryFiles, modules: [...new Set([...required, ...aliased])] }
}

describe('the packed package', () => {
  afterAll(() => {
    fs.rmSync(scratch, { recursive: true, force: true })
  })

  it('is produced by a pack run that succeeded', () => {
    // Every claim below reads that tarball, so a pack that did not run has to
    // fail here rather than throw an opaque error inside the next case.
    if (pack.error) {
      throw new Error(
        `\`yarn pack\` could not be run (${pack.error.code}); this test needs ` +
          'yarn on PATH, which `yarn test` provides'
      )
    }

    expect({ status: pack.status, stderr: (pack.stderr || '').trim() }).toEqual({
      status: 0,
      stderr: ''
    })
    expect(fs.existsSync(tarball)).toBe(true)
  })

  it('contains every file its entry points load', () => {
    const packed = readPackedFiles()
    const { entryFiles, modules } = filesTheEntryPointsLoad()

    // A module specifier resolves to `<path>.js` or `<path>/index.js`.
    const missing = [
      ...entryFiles.filter((file) => !packed.has(file)),
      ...modules.filter((module) => !packed.has(`${module}.js`) && !packed.has(`${module}/index.js`))
    ]

    expect(modules.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })

  it('runs no install script in a consumer', () => {
    const { scripts } = readPackedManifest()

    // npm runs `prepare` for a git-URL install.
    expect(scripts.postinstall).toBeUndefined()
    expect(scripts.prepare).toBeUndefined()
  })

  it('leaves the working manifest exactly as it found it', () => {
    // pinst edits package.json in place. If postpack does not run, or the
    // rewrite is not byte-for-byte, the checkout is left with a package.json
    // that installs no hooks and a diff nobody asked for.
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(manifestBefore)
  })
})
