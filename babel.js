const createPreset = require('@healthline/six-million/babel').default

module.exports = (context, opts = {}) => {
  opts = {
    ...opts
  }
  const preset = createPreset(context, opts)
  preset.plugins.push(
    [
      require.resolve('babel-plugin-module-resolver'),
      {
        alias: {
          'next/client': '@healthline/next/client',
          'next/link': '@healthline/next/link',
          'next/head': '@healthline/next/head',
          'next/page-loader': '@healthline/next/page-loader',
          'next/document': '@healthline/next/document',
          'next/router': '@healthline/next/router'
        }
      }
    ])
  return preset
}
