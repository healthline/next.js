import { resolve, join } from 'path'
import webpack from 'webpack'
import WriteFilePlugin from 'write-file-webpack-plugin'
import glob from 'glob-promise'
import { StatsWriterPlugin } from 'webpack-stats-plugin'
import getConfig from '../config'

const nextNodeModulesDir = join(__dirname, '../../../node_modules')

export default async function createCompiler (dir, { buildId = '-', dev = false, quiet = false, conf = null } = {}) {
  const addedEntries = {}

  dir = resolve(dir)
  const config = getConfig(dir, conf)
  const defaultEntries = dev ? [
    require.resolve('../../../browser/client/webpack-hot-middleware-client')
  ] : []
  const mainJS = dev
    ? require.resolve('../../../browser/client/next-dev') : require.resolve('../../../browser/client/next')

  const entry = async () => {
    const entries = {}
    const base = [
      ...defaultEntries,
      ...config.clientBootstrap || [],
      mainJS
    ]

    // In the dev environment, on-demand-entry-handler will take care of
    // managing pages.
    const loader = 'page-loader!'
    const modeDefaultPages = []
    const allPages = (await glob('./pages/**/*.js', { cwd: dir }))
        .filter((p) => !p.endsWith('pages/_document.js') && !/\.test\.js/.test(p) && !/__tests__/.test(p))
    const entryPages = dev
      ? allPages
        .filter((p) => p.endsWith('_error.js'))
        .concat(Object.values(addedEntries))
      : allPages

    for (const p of entryPages) {
      entries[p.replace(/^.*?\/pages\//, 'pages/').replace(/^(pages\/.*)\/index.js$/, '$1.js')] = base.concat(`${loader}${p}`)
    }

    return entries
  }

  const plugins = [
    new WriteFilePlugin({
      exitOnErrors: false,
      log: false,
      // required not to cache removed files
      useHashIndex: false
    }),
  ]

  if (dev) {
    plugins.push(
      new webpack.HotModuleReplacementPlugin()
    )
  } else {
    plugins.push(new webpack.NormalModuleReplacementPlugin(
      /react-hot-loader/,
      require.resolve('../../../browser/client/hot-module-loader.stub')
    ))
  }
  plugins.push(
    new StatsWriterPlugin({
      filename: 'webpack-stats.json'
    })
  )

  const mainBabelOptions = {
    cacheDirectory: true,
  }

  const rules = (dev ? [{
    test: /\.js(\?[^?]*)?$/,
    loader: 'hot-self-accept-loader',
    include: [
      join(dir, 'pages')
    ]
  }] : [])
    .concat([{
      test: /\.js(\?[^?]*)?$/,
      loader: 'babel-loader',
      include: [dir],
      exclude (str) {
        return /node_modules/.test(str)
      },
      options: mainBabelOptions
    }])

  let webpackConfig = {
    name: 'client',
    mode: dev ? 'development' : 'production',
    target: 'web',
    context: dir,
    entry,
    output: {
      pathinfo: !!dev,
      path: join(dir, '.next', 'bundles'),
      filename: '[name]',
      publicPath: `/_next/${buildId}/`,
      strictModuleExceptionHandling: true,
      // This saves chunks with the name given via require.ensure()
      chunkFilename: !dev ? '[name]-[chunkhash:5].js' : '[name].js'
    },
    resolve: {
      modules: [
        nextNodeModulesDir,
        'node_modules'
      ],
      alias: {
        'html-entities': resolve('../../../browser/lib/html-entities'),
        'object-assign': 'core-js/fn/object/assign',
        'strip-ansi': resolve('../../../browser/client/strip-ansi.stub')
      }
    },
    resolveLoader: {
      modules: [
        nextNodeModulesDir,
        'node_modules',
        join(__dirname, 'loaders')
      ]
    },
    plugins,
    module: {
      rules
    },
    devtool: dev ? 'nosources-inline-source-map' : 'source-map',

    optimization: {
      namedModules: !dev,
      minimize: !dev,
      splitChunks: { // CommonsChunkPlugin()
        name: true,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'initial',
            minChunks: 2
          }
        }
      },
      noEmitOnErrors: true,
      concatenateModules: !dev
    },
    performance: { hints: false }
  }

  if (config.webpack) {
    console.log(`> Using "webpack" config function defined in ${config.configOrigin}.`)
    webpackConfig = await config.webpack(webpackConfig, { buildId, dev })
  }

  const compiler = webpack(webpackConfig)
  compiler.setEntry = (name, path) => {
    addedEntries[name] = path
  }
  return compiler
}
