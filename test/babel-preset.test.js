// babel.js turns off the preset-env debug dump that six-million's preset
// hardcodes, by rewriting preset-env's [resolvedPath, options] entry in the
// `presets` array six-million returns.
//
// The preset takes Babel's API object as its first argument. Neither babel.js
// nor six-million's preset reads it, so a bare object stands in for it here.

const apiStub = {}

const presetEnvEntry = (preset) =>
  preset.presets.find(
    (entry) => Array.isArray(entry) && /preset-env/.test(entry[0])
  )

describe('the @healthline/next Babel preset', () => {
  it("keeps six-million's preset-env entry, with only the debug dump turned off", () => {
    const sixMillions = presetEnvEntry(
      require('@healthline/six-million/babel').default(apiStub, {})
    )
    const ours = presetEnvEntry(require('../babel.js')(apiStub))

    expect(ours).toEqual([sixMillions[0], { ...sixMillions[1], debug: false }])
  })
})
