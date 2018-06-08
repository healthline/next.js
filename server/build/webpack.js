import { resolve, join } from 'path'
import webpack from 'webpack'
import WriteFilePlugin from 'write-file-webpack-plugin'
import resolveRequest from 'resolve'
import glob from 'glob-promise'
import FriendlyErrorsWebpackPlugin from 'friendly-errors-webpack-plugin'
import CaseSensitivePathPlugin from 'case-sensitive-paths-webpack-plugin'
import { StatsWriterPlugin } from 'webpack-stats-plugin'
import getConfig from '../config'
import rootModuleRelativePath from './root-module-relative-path'
import { nextModuleDir, nextNodeModulesDir } from '../utils'

// Relative to our dist dir

const relativeResolve = rootModuleRelativePath(require)

function externalsConfig (dir, isServer) {
  const externals = []

  if (!isServer) {
    return externals
  }

  externals.push((context, request, callback) => {
    resolveRequest(request, { basedir: dir, preserveSymlinks: true }, (err, res) => {
      if (err) {
        return callback()
      }

      // // Webpack itself has to be compiled because it doesn't always use module relative paths
      // if (res.match(/node_modules[/\\]webpack/)) {
      //   return callback()
      // }

      if (res.match(/node_modules[/\\].*\.js$/)) {
        return callback(null, `commonjs ${request}`)
      }

      // Default pages have to be transpiled
      if (res.indexOf(nextModuleDir) === 0) {
        return callback()
      }

      callback()
    })
  })

  return externals
}

async function createConfig (dir, dynamicEntries, { isServer, buildId = '-', dev = false, quiet = false, buildDir, conf = null } = {}) {
  dir = resolve(dir)
  const config = getConfig(dir, conf)
  const defaultEntries = dev ? [
    join(nextModuleDir, 'client', 'webpack-hot-middleware-client')
  ] : []
  const mainJS = dev
    ? require.resolve('../../../../client/next-dev') : require.resolve('../../../../client/next')

  const entry = async () => {
    const entries = {}
    const base = isServer ? [] : [
      ...defaultEntries,
      ...config.clientBootstrap || [],
      mainJS
    ]

    // In the dev environment, on-demand-entry-handler will take care of
    // managing pages.
    const loader = isServer ? '' : 'page-loader!'
    const modeDefaultPages = isServer ? ['_error.js', '_document.js'] : ['_error.js']
    const allPages = (await glob('./pages/**/*.js', { cwd: dir })).filter((p) => !/\.test\.js/.test(p))
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
        entries[entryName] = `${loader}${join(nextModuleDir, 'pages', p)}`
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
      require.resolve('../../client/hot-module-loader.stub')
    ))
  }
  plugins.push(
    new StatsWriterPlugin({
      filename: 'webpack-stats.json'
    })
  )

  const mainBabelOptions = {
    cacheDirectory: true,
    presets: [
      [require.resolve('./babel/preset'), {isServer: !!isServer}]
    ]
  }

  const rules = (!isServer && dev ? [{
    test: /\.js(\?[^?]*)?$/,
    loader: 'hot-self-accept-loader',
    include: [
      join(dir, 'pages'),
      join(nextModuleDir, 'pages')
    ]
  }] : [])
    .concat([{
      loader: 'babel-loader',
      include: nextModuleDir,
      exclude (str) {
        return /node_modules/.test(str)
      },
      options: {
        babelrc: false,
        cacheDirectory: true,
        presets: [require.resolve('./babel/preset')]
      }
    }, {
      test: /\.js(\?[^?]*)?$/,
      loader: 'babel-loader',
      include: [dir],
      exclude (str) {
        return /node_modules/.test(str)
      },
      options: mainBabelOptions
    }])

  const path = join(buildDir ? join(buildDir, '.next') : join(dir, config.distDir), isServer ? 'server' : 'bundles')

  let webpackConfig = {
    name: isServer ? 'server' : 'client',
    mode: dev ? 'development' : 'production',
    target: isServer ? 'node' : 'web',
    externals: externalsConfig(dir, isServer),
    context: dir,
    entry,
    output: {
      path,
      filename: '[name]',
      publicPath: `/_next/${buildId}/`,
      strictModuleExceptionHandling: true,
      libraryTarget: isServer ? 'commonjs2' : undefined,
      // This saves chunks with the name given via require.ensure()
      chunkFilename: !dev && !isServer ? '[name]-[chunkhash:5].js' : '[name].js'
    },
    resolve: {
      modules: [
        nextNodeModulesDir,
        'node_modules'
      ],
      alias: {
        'babel-runtime': relativeResolve('babel-runtime/package'),
        'html-entities': join(nextModuleDir, './lib/html-entities'),
        'next/link': join(nextModuleDir, './lib/link'),
        'next/dynamic': join(nextModuleDir, './lib/dynamic'),
        'next/same-loop-promise': join(nextModuleDir, './lib/same-loop-promise'),
        'next/page-loader': join(nextModuleDir, './lib/page-loader'),
        'next/head': join(nextModuleDir, './lib/head'),
        'next/document': join(nextModuleDir, './server/document'),
        'next/router': join(nextModuleDir, './lib/router'),
        'next/error': join(nextModuleDir, './lib/error')
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
      namedModules: !dev && !isServer,
      minimize: !dev && !isServer,
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
    webpackConfig = await config.webpack(webpackConfig, { buildId, dev, isServer })
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
