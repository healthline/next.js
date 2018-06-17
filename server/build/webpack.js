import { resolve, join } from 'path'
import webpack from 'webpack'
import WriteFilePlugin from 'write-file-webpack-plugin'
import glob from 'glob-promise'
import FriendlyErrorsWebpackPlugin from 'friendly-errors-webpack-plugin'
import CaseSensitivePathPlugin from 'case-sensitive-paths-webpack-plugin'
import { StatsWriterPlugin } from 'webpack-stats-plugin'
import getConfig from '../config'

const nextPagesDir = join(__dirname, '..', '..', '..', 'pages')
const nextLibDir = join(__dirname, '..', '..', '..', 'lib')
const nextClientDir = join(__dirname, '..', '..', '..', 'client')
const nextNodeModulesDir = join(__dirname, '..', '..', '..', 'node_modules')

async function createConfig (dir, dynamicEntries, { buildId = '-', dev = false, quiet = false, buildDir, conf = null } = {}) {
  dir = resolve(dir)
  const config = getConfig(dir, conf)
  const defaultEntries = dev ? [
    require.resolve('../../../client/webpack-hot-middleware-client')
  ] : []
  const mainJS = dev
    ? require.resolve('../../../client/next-dev') : require.resolve('../../../client/next')

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
    const modeDefaultPages = ['_error.js']
    const allPages = (await glob('./pages/**/*.js', { cwd: dir })).filter((p) => p !== 'pages/_document.js' && !/\.test\.js/.test(p))
    const entryPages = dev
      ? allPages
        .filter((p) => modeDefaultPages.find((defaultPage) => p.endsWith(defaultPage)))
        .concat(Object.values(dynamicEntries()))
      : allPages

    for (const p of entryPages) {
      entries[p.replace(/^.*?\/pages\//, 'pages/').replace(/^(pages\/.*)\/index.js$/, '$1.js')] = base.concat(`${loader}${p}`)
    }
    for (const p of modeDefaultPages) {
      const entryName = join('pages', p)
      if (!entries[entryName]) {
        entries[entryName] = `${loader}${join(nextPagesDir, p)}`
      }
    }

    return entries
  }

  const plugins = [
    // new webpack.LoaderOptionsPlugin({
    //   options: {
    //     context: dir,
    //     customInterpolateName (url, name, opts) {
    //       return interpolateNames.get(this.resourcePath) || url
    //     }
    //   }
    // }),
    new WriteFilePlugin({
      exitOnErrors: false,
      log: false,
      // required not to cache removed files
      useHashIndex: false
    }),
    // new PagesPlugin(),
    new CaseSensitivePathPlugin()
  ]

  if (dev) {
    plugins.push(
      new webpack.HotModuleReplacementPlugin()
    )
    if (!quiet) {
      plugins.push(new FriendlyErrorsWebpackPlugin())
    }
  } else {
    plugins.push(new webpack.NormalModuleReplacementPlugin(
      /react-hot-loader/,
      require.resolve('../../../client/hot-module-loader.stub')
    ))
  }
  plugins.push(
    new StatsWriterPlugin({
      filename: 'webpack-stats.json'
    })
  )

  const mainBabelOptions = {
    cacheDirectory: true
  }

  const rules = (dev ? [{
    test: /\.js(\?[^?]*)?$/,
    loader: 'hot-self-accept-loader',
    include: [
      join(dir, 'pages'),
      join(nextPagesDir)
    ]
  }] : [])
    .concat([nextPagesDir, nextClientDir, nextLibDir].map(dir => ({
      loader: 'babel-loader',
      include: dir,
      options: {
        babelrc: false,
        cacheDirectory: true,
        presets: [require.resolve('./babel/preset')]
      }
    })))
    .concat([{
      test: /\.json$/,
      loader: 'json-loader'
    }, {
      test: /\.js(\?[^?]*)?$/,
      loader: 'babel-loader',
      include: [dir],
      exclude (str) {
        return /node_modules/.test(str)
      },
      options: mainBabelOptions
    }])

  const path = join(buildDir ? join(buildDir, '.next') : join(dir, config.distDir), 'bundles')

  let webpackConfig = {
    name: 'client',
    mode: dev ? 'development' : 'production',
    target: 'web',
    context: dir,
    entry,
    output: {
      path,
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
        'html-entities': join(nextLibDir, './html-entities')
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
  return webpackConfig
}

export default async function createCompiler (dir, opts) {
  const entries = {}
  const compiler = webpack([
    await createConfig(dir, () => entries, {isServer: true, ...opts}),
    await createConfig(dir, () => entries, {isServer: false, ...opts})
  ])
  compiler.setEntry = (name, path) => {
    entries[name] = path
  }
  return compiler
}
