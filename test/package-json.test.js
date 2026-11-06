// Two things package.json states and nothing else in the repository does:
// which directories the build writes and wipes, and what the tarball
// contains. Both were rotting silently before these specs existed, and both
// read the same derivation, which is why they are one file.
//
// `yarn build` is `yarn clean:build && yarn build:package`, and the order of
// those halves is load-bearing. six-million's build-package deletes only
// node/server and node/lib before compiling
// (node_modules/@healthline/six-million/node/babel/build-package.js), so any
// other file left in node/ from an earlier build survives and npm pack
// publishes it. A stray node/stale.js was found in the tarball with the clean
// step gone, which is why the step exists.
// Collapsing `build` back to `yarn build:package` is silent: lint, tests,
// build and CI all stay green, because nothing else reads these scripts.
//
// The `files` list is the whole of what npm puts in the tarball. Six entries
// (link.js, head.js, document.js, dynamic.js, router.js, error.js) sat in
// that list for years after commit 32ca11d870 deleted the files, and the
// published 25.0.0 and 26.1.1 tarballs shipped without them; no build step
// and no test noticed.
//
// This package's tarball has exactly two kinds of entry:
//
//   - build output: six-million's build-package compiles ./server and ./lib
//     into node/, and ./client and ./lib into browser/. It compiles more than
//     those roots: its Babel compile step follows every relative import it reaches
//     (in six-million's node/babel/), which is why node/client/router.js
//     exists -- lib/link.js imports '../client/router'.
//     Those two directories are gitignored, so they are absent in a clone
//     that has not run `yarn build` and these specs must not require them.
//   - files that live in the checkout: bin/ and babel.js.
//
// Every entry carries a leading slash. An unanchored pattern matches the name
// at any depth, so `babel.js` also matched a nested worktree's babel.js
// and npm pack put it in the tarball.
// The anchored form matches only the package root, so the entries below are
// read with their leading slash and compared that way, and un-anchoring them
// in package.json fails all three files cases -- in a built tree and in an
// unbuilt one, because the derived names carry the slash and a bare `node`
// is then neither derived nor a file.
//
// Which directories may be published is not a judgement this file makes; it
// is derived from the two places in package.json that the build and the
// installed CLI already read: `clean:build` and `bin`. A directory in the
// checkout that neither source names is untranspiled source: `client`,
// `server` and `lib` are compiled into node/ and browser/, and publishing
// them would ship ESM and JSX to consumers. So a directory entry passes only
// when one of those two sources names it, and a file entry passes only when
// the file exists.
//
// Every case here reads package.json alone, so all of them pass in a clone
// that has never run a build.

const fs = require('fs')
const path = require('path')

const packageRoot = path.join(__dirname, '..')
const { bin, files, scripts } = require('../package.json')

const CLEAN_SCRIPT = 'clean:build'

// The one derivation both halves of this file read. `clean:build` is the only
// place the repository states which directories the build writes, and the
// names are read out of its array literal rather than searched for in the
// whole command, so that the `node` in `node -e` cannot supply the name
// `node`.
//
// A reshaped or deleted script used to make this parse throw an opaque
// TypeError at module load, which named neither the script nor the reason.
// It now throws with both, because the likeliest cause is deliberate: the
// planned move to Vite removes the webpack path and six-million together, and `build:package` is
// six-million's entry point, so this script is expected to be rewritten. Its
// replacement has to state the output directory set somewhere a reader can
// find, and this derivation has to be pointed at wherever that is.
const buildOutputDirectoriesFromCleanScript = () => {
  const script = scripts[CLEAN_SCRIPT]

  if (!script) {
    throw new Error(
      `${path.basename(__filename)} derives the build output directories ` +
        `from the \`${CLEAN_SCRIPT}\` script in package.json, and there is ` +
        'no such script. If the build no longer cleans its output, point ' +
        'this derivation at whatever now states the set, or delete the ' +
        'cases that read it.'
    )
  }

  const literal = script.match(/\[([^\]]*)\]/)

  if (!literal) {
    throw new Error(
      `${path.basename(__filename)} reads the build output directories out ` +
        `of an array literal in the \`${CLEAN_SCRIPT}\` script, and that ` +
        `script no longer contains one: ${script}. Point this derivation at ` +
        'whatever now states the set.'
    )
  }

  return literal[1].split(',').map((name) => name.trim().slice(1, -1))
}

const buildOutputDirectories = buildOutputDirectoriesFromCleanScript()

const BUILD_SCRIPT = 'build'

// The same named-error treatment as the derivation above, for the same
// reason. `scripts.build` was read with an unguarded `.split`, so deleting
// the script raised a TypeError naming neither the script nor this file.
// The planned move to Vite rewrites this script, so its absence is a
// likely deliberate change rather than a corrupt manifest.
const buildStepsFromBuildScript = () => {
  const script = scripts[BUILD_SCRIPT]

  if (!script) {
    throw new Error(
      `${path.basename(__filename)} reads the build's steps from the ` +
        `\`${BUILD_SCRIPT}\` script in package.json, and there is no such ` +
        'script. If the build is invoked some other way now, point this ' +
        'case at whatever states the order of clean and compile, or delete ' +
        'the cases that read it.'
    )
  }

  return script.split('&&').map((step) => step.trim())
}

// The same set as the tarball's entries spell it: '/node'.
const publishedBuildOutput = buildOutputDirectories.map((name) => '/' + name)

// The root directory a bin target resolves out of: './bin/next-build' gives
// '/bin'.
const rootDirectoryOf = (target) =>
  '/' + path.normalize(target).split(path.sep)[0]

const publishableDirectories = [
  ...publishedBuildOutput,
  ...Object.values(bin).map(rootDirectoryOf)
]

describe('the build script', () => {
  it('cleans the output directories before compiling into them', () => {
    // `yarn build:package` is six-million's build entry point, named here as
    // a literal because the order of the two halves is the claim. The planned
    // move to Vite deletes six-million with the webpack path, and
    // bin/next-build with it, so this step is replaced rather
    // than kept. Removing it requires replacing this case with the same claim
    // about whatever runs the build then: that the output is cleared before
    // anything is compiled into it.
    const steps = buildStepsFromBuildScript()

    const cleanStep = steps.findIndex((step) => step === `yarn ${CLEAN_SCRIPT}`)
    const compileStep = steps.findIndex((step) => step === 'yarn build:package')

    expect(cleanStep).not.toBe(-1)
    expect(compileStep).not.toBe(-1)
    expect(cleanStep).toBeLessThan(compileStep)
  })

  it('cleans every directory the build publishes', () => {
    // build-package removes node/server and node/lib itself but nothing else
    // under node/, and it removes browser/ wholesale. The clean step has to
    // name both roots or a stale file under the unnamed one is published.
    //
    // The expected set is stated here rather than derived, so that this case
    // says something the derivation cannot: these two directories, and no
    // others. When that deletion lands and the Vite build writes
    // a different set, this literal is what has to change, deliberately.
    expect(buildOutputDirectories.sort()).toEqual(['browser', 'node'])
  })
})

describe('the published files list', () => {
  it('names only build output, bin, and files the checkout carries', () => {
    const unbacked = files.filter((entry) => {
      if (publishableDirectories.includes(entry)) return false

      const onDisk = path.join(packageRoot, entry)
      return !fs.existsSync(onDisk) || fs.statSync(onDisk).isDirectory()
    })

    expect(unbacked).toEqual([])
  })

  it('names the entries every public import resolves through', () => {
    // babel.js aliases every `next/*` specifier to a deep path under node/ or
    // browser/, and package.json main points into node/. Losing either
    // directory from the list would publish a tarball that resolves nothing.
    for (const directory of publishedBuildOutput) {
      expect(files).toContain(directory)
    }
    expect(files).toContain('/babel.js')
  })

  it('names the directory each bin target resolves out of', () => {
    // `bin` makes next-build an installed executable. If its directory is not
    // published, the tarball installs a command that cannot be run.
    //
    // The plan is for @healthline/next to ship no development or build binary
    // and for `next-build` to be deleted with the webpack path, so this case is scheduled to go red. Removing it
    // requires the same change that empties `bin`: frontend running Vite's
    // own CLI instead of this executable. Until then a non-empty `bin` is a
    // published contract, which is why it is asserted rather than assumed.
    expect(Object.keys(bin).length).toBeGreaterThan(0)

    for (const target of Object.values(bin)) {
      expect(files).toContain(rootDirectoryOf(target))
      expect(fs.existsSync(path.join(packageRoot, target))).toBe(true)
    }
  })
})
