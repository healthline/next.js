// VITE-MIGRATION(webpack-deletion): Delete this file with babel.js's
// six-million preset, once no site builds with webpack.
//
// This protects six-million's preset-env targets and module settings. babel.js
// rewrites preset-env's [resolvedPath, options] entry to turn off the debug
// dump, and a rewrite that drops the other options changes every consumer's
// build output with no error anywhere. A lost `debug: false` would show in
// the build log on its own.
//
// The preset takes Babel's API object as its first argument. Neither babel.js
// nor six-million's preset reads it, so a bare object stands in for it here.

const apiStub = {}

const presetEnvEntry = (preset) =>
  preset.presets.find(
    (entry) => Array.isArray(entry) && /preset-env/.test(entry[0])
  )

describe('the @healthline/next Babel preset', () => {
  it("keeps six-million's preset-env targets and module settings, turning off only the debug dump", () => {
    const sixMillions = presetEnvEntry(
      require('@healthline/six-million/babel').default(apiStub, {})
    )
    const ours = presetEnvEntry(require('../babel.js')(apiStub))

    expect(ours).toEqual([sixMillions[0], { ...sixMillions[1], debug: false }])
  })
})
