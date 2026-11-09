// What the tarball's `scripts` say decides whether a consumer's install runs
// this package's dev-only hook installer. `postinstall` is a script both Yarn
// and npm run for dependencies, so leaving it in the tarball would make every
// consumer's install try to write husky hooks into their checkout. The only
// thing preventing that is pinst: `prepack` runs `pinst --disable`, which
// renames the script to `_postinstall` in package.json, and `postpack` runs
// `pinst --enable`, which renames it back.
//
// That wiring rots silently: Yarn never runs `prepublishOnly` or
// `postpublish`, so the rename has to sit on `prepack` and `postpack`.
//
// So the claim here is made against a real tarball rather than against the
// manifest: pack the package the way a publish would, read the manifest out
// of the tarball, and check the working manifest is exactly as it was
// afterwards. Reading `package.json` alone could not fail, because the rename
// only exists between prepack and postpack.
//
// `npm pack --dry-run --json` would be cheaper and would prove nothing: it
// reports the file list without running Yarn's pack lifecycle, so pinst never
// runs and the manifest it reports is the working one.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const packageRoot = path.join(__dirname, '..')
const manifestPath = path.join(packageRoot, 'package.json')

// Scratch goes to the system temp directory, never into the checkout, and the tarball is large enough that leaving it behind matters.
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

describe('the packed manifest', () => {
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

  it('runs no install script in a consumer, and keeps the disabled one', () => {
    const { scripts } = readPackedManifest()

    // npm runs `prepare` for a git-URL install.
    expect(scripts.postinstall).toBeUndefined()
    expect(scripts.prepare).toBeUndefined()

    // pinst's rename, not an absence: the script has to survive into the
    // tarball under its disabled name, because `pinst --enable` in postpack
    // is what puts it back in the working tree.
    const { scripts: working } = JSON.parse(manifestBefore)
    expect(scripts._postinstall).toBe(working.postinstall)
  })

  it('leaves the working manifest exactly as it found it', () => {
    // pinst edits package.json in place. If postpack does not run, or the
    // rewrite is not byte-for-byte, the checkout is left with a package.json
    // that installs no hooks and a diff nobody asked for.
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(manifestBefore)
  })
})
