const createPreset = require('@healthline/six-million/babel').default

const isJest = !!process.env.JEST_WORKER_ID
const isServer = !!process.env.IS_SERVER || isJest

// six-million's preset hardcodes preset-env's `debug: true`, so every file
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
  preset.presets = withoutPresetEnvDebug(preset.presets)
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
