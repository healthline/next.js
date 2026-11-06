const createPreset = require('@healthline/six-million/babel').default

const isJest = !!process.env.JEST_WORKER_ID
const isServer = !!process.env.IS_SERVER || isJest

// six-million's preset hardcodes preset-env's `debug: true`
// (node_modules/@healthline/six-million/node/babel/preset.js:33), so every file
// Babel compiles prints a targets and plugin dump. A Babel preset is a plain
// config object, so this package turns the flag off on the entry it already wraps
// rather than adding a Babel config file of its own.
const withoutPresetEnvDebug = presets =>
  presets.map(preset =>
    Array.isArray(preset) && /preset-env/.test(preset[0])
      ? [preset[0], { ...preset[1], debug: false }]
      : preset
  )

module.exports = (context, opts = {}) => {
  opts = {
    ...opts
  }
  const preset = createPreset(context, opts)
  // `|| []`: the shape read here is six-million's, not this package's. A version
  // that returns no presets must leave this preset loading rather than
  // throwing "Cannot read properties of undefined (reading 'map')" for every
  // consumer -- this package's Jest, frontend Jest, Storybook, frontend's babel-loader
  // rules. The dump coming back is the regression worth a test
  // (test/babel-preset.test.js); a crash is not a way to report it.
  preset.presets = withoutPresetEnvDebug(preset.presets || [])
  // `|| []` for the same reason as the line above, against the same
  // six-million-owned shape: `plugins` is part of the config six-million
  // returns, not something this package creates. A version that returns no
  // plugins key must not turn the alias table below into "Cannot read
  // properties of undefined (reading 'push')" for every consumer. Those
  // aliases are what make `next/*` resolve at all, so they have to land
  // whether or not six-million contributed a plugin of its own.
  preset.plugins = preset.plugins || []
  preset.plugins.push(
    [
      require.resolve('babel-plugin-module-resolver'),
      {
        alias: {
          'next/client': isServer ? undefined : '@healthline/next/browser/client',
          'next/link': isServer ? '@healthline/next/node/lib/link' : '@healthline/next/browser/lib/link',
          'next/head': isServer ? '@healthline/next/node/lib/head' : '@healthline/next/browser/lib/head',
          'next/page-loader': isServer ? '@healthline/next/node/lib/page-loader' : '@healthline/next/browser/lib/page-loader',
          'next/document': isServer ? '@healthline/next/node/server/document' : undefined,
          'next/router': isServer ? '@healthline/next/node/server/router' : '@healthline/next/browser/client/router'
        }
      }
    ])
  return preset
}
