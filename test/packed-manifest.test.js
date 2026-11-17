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

const unpackPackedPackage = () => {
  const packageDir = path.join(scratch, 'package')
  if (fs.existsSync(packageDir)) return packageDir

  const unpack = spawnSync('tar', ['-xzf', tarball, '-C', scratch], { encoding: 'utf8' })
  if (unpack.status !== 0) throw new Error(unpack.stderr)
  return packageDir
}

const packedConsumerModules = () => {
  const packageDir = unpackPackedPackage()
  const modules = path.join(scratch, 'node_modules')
  fs.mkdirSync(path.join(modules, '@healthline'), { recursive: true })

  const packageLink = path.join(modules, '@healthline/next')
  if (!fs.existsSync(packageLink)) fs.symlinkSync(packageDir, packageLink)

  const manifest = readPackedManifest()
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
    const destination = path.join(modules, name)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    if (!fs.existsSync(destination)) {
      fs.symlinkSync(path.join(packageRoot, 'node_modules', name), destination)
    }
  }

  return modules
}

const fixtureDir = path.join(__dirname, 'fixtures', 'packed-consumer')

const runNode = (entry, args = [], nodeOptions = []) => {
  const run = spawnSync(process.execPath, [...nodeOptions, entry, ...args], {
    cwd: scratch,
    encoding: 'utf8',
    timeout: 10000
  })
  if (run.status !== 0) {
    throw new Error(`${path.basename(entry)} failed (exit ${run.status}):\n${run.error || ''}\n${run.stdout}${run.stderr}`)
  }
  return run.stdout
}

// Fixtures run from the scratch directory. Inside the checkout, Node would
// resolve `@healthline/next` to the source tree instead of the tarball.
const runConsumer = (name, nodeOptions = []) => {
  packedConsumerModules()
  fs.copyFileSync(path.join(fixtureDir, name), path.join(scratch, name))
  runNode(path.join(scratch, name), [], nodeOptions)
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

  it('packs every file the manifest points at', () => {
    const manifest = readPackedManifest()
    const targetsOf = (entry) => typeof entry === 'string' ? [entry] : Object.values(entry).flatMap(targetsOf)
    const named = [manifest.main, manifest.types, ...Object.values(manifest.bin), ...targetsOf(manifest.exports)]
    const files = readPackedFiles()

    expect(named.map(target => path.posix.normalize(target)).filter(target => !files.has(target))).toEqual([])
  })

  it('runs the packed next-build command and shows its usage', () => {
    packedConsumerModules()
    const cli = path.join(unpackPackedPackage(), readPackedManifest().bin['next-build'])
    expect(runNode(cli, ['--help'])).toContain('Compiles the application for production deployment')
  })

  it('resolves each entry to its Node build, and rejects private paths', () => {
    runConsumer('entry-builds.cjs')
  })

  it('resolves browser entries to their browser builds under the browser condition', () => {
    runConsumer('entry-builds.cjs', ['--conditions=browser'])
  })

  it('gives import and require the same exports', () => {
    runConsumer('esm-entries.mjs')
  })

  it.each([
    ['browser-types.ts', 'test/fixtures/packed-consumer/browser-types.ts', [
      '--module', 'esnext', '--target', 'es2015', '--moduleResolution', 'bundler', '--customConditions', 'browser'
    ]],
    ['server-types.ts', 'test/fixtures/packed-consumer/server-types.ts', [
      '--module', 'esnext', '--target', 'es2015', '--moduleResolution', 'bundler'
    ]]
  ])('type-checks the packed consumer %s', (name, fixture, options) => {
    packedConsumerModules()
    const emptyTypeRoots = path.join(scratch, 'type-roots')
    fs.mkdirSync(emptyTypeRoots, { recursive: true })
    const source = path.join(packageRoot, fixture)
    fs.copyFileSync(source, path.join(scratch, name))

    const compile = spawnSync(
      path.join(packageRoot, 'node_modules', '.bin', 'tsc'),
      ['--noEmit', '--strict', '--typeRoots', emptyTypeRoots, ...options, name],
      { cwd: scratch, encoding: 'utf8' }
    )
    if (compile.status !== 0) {
      throw new Error(
        `TypeScript rejected ${name} (source: ${path.relative(packageRoot, source)}).\n` +
        `${compile.error || ''}\n${compile.stdout}${compile.stderr}`
      )
    }
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
