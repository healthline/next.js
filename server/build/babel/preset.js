const envPlugins = {
  'development': [
    require.resolve('babel-plugin-transform-react-jsx-source')
  ],
  'production': [
    require.resolve('babel-plugin-transform-react-remove-prop-types')
  ]
}

const plugins = envPlugins[process.env.NODE_ENV] || envPlugins['development']

module.exports = (context, opts = {}) => ({
  presets: [
    [require.resolve('babel-preset-env'), {
      modules: false,
      targets: opts.isServer ? { node: 'current' } : { ie: 11 },
      ...opts['preset-env']
    }],
    require.resolve('babel-preset-react')
  ],
  plugins: [
    require.resolve('react-hot-loader/babel'),
    require.resolve('babel-plugin-react-require'),
    require.resolve('./plugins/handle-import'),
    require.resolve('babel-plugin-transform-object-rest-spread'),
    require.resolve('babel-plugin-transform-class-properties'),
    [require.resolve('babel-plugin-transform-runtime'), opts['transform-runtime'] || {polyfill: false}]
  ].concat(plugins)
})
