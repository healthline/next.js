// Packs the package the way a publish does and reads the real tarball: only it
// shows the files that ship and the `scripts` after pinst has edited them.
// `npm pack --dry-run` skips Yarn's pack lifecycle, so it could not fail.

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

// `main`, each `bin` command and the Babel preset; the files the commands
// require directly; and each `@healthline/next/...` target the preset aliases
// `next/*` to. It does not follow imports any further. `modules` are
// extensionless, each a `.js` file or a directory with an index.
const filesTheEntryPointsName = () => {
  const manifest = JSON.parse(manifestBefore)
  const binFiles = Object.values(manifest.bin).map((file) => path.posix.normalize(file))
  const entryFiles = [path.posix.normalize(manifest.main), ...binFiles, 'babel.js']

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
          'yarn on PATH. Run it with `yarn test:pack`.'
      )
    }

    // Yarn reports a failed lifecycle script on stdout, naming the log that holds
    // the script's own output, so both streams are shown.
    if (pack.status !== 0) {
      throw new Error(
        `\`yarn pack\` exited ${pack.status}.\n` +
          `stdout:\n${pack.stdout}\nstderr:\n${pack.stderr}`
      )
    }
    expect(fs.existsSync(tarball)).toBe(true)
  })

  it('contains the entry points, what the bin commands require, and the preset\'s alias targets', () => {
    const packed = readPackedFiles()
    const { entryFiles, modules } = filesTheEntryPointsName()

    // A module specifier resolves to `<path>.js` or `<path>/index.js`.
    const missing = [
      ...entryFiles.filter((file) => !packed.has(file)),
      ...modules.filter((module) => !packed.has(`${module}.js`) && !packed.has(`${module}/index.js`))
    ]

    expect(modules.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })

  it('runs no install script in a consumer', () => {
    const { scripts = {} } = readPackedManifest()

    // npm runs the first three on every install, and `prepare` on a git-URL install.
    const shippedInstallHooks = ['preinstall', 'install', 'postinstall', 'prepare']
      .filter((hook) => hook in scripts)
      .map((hook) => `${hook}: ${scripts[hook]}`)
    expect(shippedInstallHooks).toEqual([])
  })

  it('leaves the working manifest exactly as it found it', () => {
    // pinst edits package.json in place. If postpack does not run, or the
    // rewrite is not byte-for-byte, the checkout is left with a package.json
    // that installs no hooks and a diff nobody asked for.
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(manifestBefore)
  })
})
