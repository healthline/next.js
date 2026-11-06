// babel.js turns off the preset-env debug dump that six-million's preset
// hardcodes. It does so by rewriting a shape six-million owns: preset-env
// arriving as [resolvedPath, options] inside a `presets` array. A six-million
// upgrade that changed that shape would restore the dump for every consumer of
// this preset -- this package's Jest, frontend Jest, Storybook, frontend's babel-loader
// rules -- or throw where this package previously worked, and until now only a
// manual --no-cache run said otherwise.
//
// The preset takes Babel's API object as its first argument. Neither babel.js
// nor six-million's preset reads it (node_modules/@healthline/six-million/
// node/babel/preset.js), so a bare object stands in for it here; that is the
// whole contract this test needs from Babel.

const apiStub = {}

const presetEnvEntry = (preset) =>
  preset.presets.find(
    (entry) => Array.isArray(entry) && /preset-env/.test(entry[0])
  )

describe('the @healthline/next Babel preset', () => {
  it('turns off preset-env\'s debug dump', () => {
    const preset = require('../babel.js')(apiStub)
    const entry = presetEnvEntry(preset)

    expect(entry).toBeDefined()
    expect(entry[1].debug).toBe(false)
  })

  it('keeps the rest of six-million\'s preset-env options', () => {
    // The rewrite replaces the options object, so it has to carry the
    // originals forward. Targets are the ones whose loss would change output
    // silently.
    const entry = presetEnvEntry(require('../babel.js')(apiStub))

    expect(entry[1].targets).toBeDefined()
    expect(entry[1].modules).toBe(false)
  })

  it('loads when six-million returns a config with no presets', () => {
    // A shape change is a reason for the dump to come back, not a reason for
    // this package to stop compiling.
    jest.resetModules()
    jest.doMock('@healthline/six-million/babel', () => ({
      default: () => ({ plugins: [] })
    }))

    const preset = require('../babel.js')(apiStub)

    expect(preset.presets).toEqual([])
    jest.dontMock('@healthline/six-million/babel')
    jest.resetModules()
  })

  it('still contributes the next/* aliases when six-million returns no plugins', () => {
    // The alias table is the only reason `next/link` and friends resolve
    // anywhere -- this package's Jest, frontend Jest, Storybook, frontend's
    // babel-loader rules. A six-million config with no plugins key must not
    // cost this package its aliases, nor cost every consumer "Cannot read
    // properties of undefined (reading 'push')" before Babel compiles a file.
    jest.resetModules()
    jest.doMock('@healthline/six-million/babel', () => ({
      default: () => ({})
    }))

    const preset = require('../babel.js')(apiStub)
    const moduleResolver = preset.plugins.find(
      (entry) => Array.isArray(entry) && /module-resolver/.test(entry[0])
    )

    expect(moduleResolver).toBeDefined()
    expect(moduleResolver[1].alias['next/link']).toBe(
      '@healthline/next/node/lib/link'
    )
    jest.dontMock('@healthline/six-million/babel')
    jest.resetModules()
  })
})
