import { resolve, join } from 'path'
import fs from 'fs'

import getConfig from './config'
import { checkAssets } from './page-assets'
import { doPageRender, doDocRender } from './render'

export default class Server {
  // The options are declared in index.d.ts.
  constructor ({ dir = '.', dev = false, quiet = false, conf = null, assets, loadPage } = {}) {
    if (loadPage !== undefined && typeof loadPage !== 'function') {
      throw new TypeError('loadPage must be a function')
    }
    this.dir = resolve(dir)
    this.dev = dev
    this.quiet = quiet
    this.loadPage = loadPage

    // The consumer built the application. Nothing below this block runs, so
    // the server reads no next.config.js, build ID file or webpack output.
    if (assets !== undefined) {
      this.assets = checkAssets(assets)
      this.config = {}
      this.hotReloader = null
      this.renderOpts = {
        dev,
        dir: this.dir,
        hotReloader: null,
        publicPath: '/_next/',
        buildId: this.assets.buildId,
        entrypoints: undefined
      }
      return
    }

    // VITE-MIGRATION(webpack-deletion): everything from here to the end of the
    // constructor is the webpack path, unchanged from 28.0 apart from this check.
    // Webpack's dev server compiles a page's browser entry only when it loads
    // that page from disk, so a page from loadPage would render with no scripts.
    if (dev && loadPage !== undefined) {
      throw new TypeError('loadPage with dev: true requires assets; webpack development compiles only pages it loads from disk')
    }
    this.config = getConfig(this.dir, conf)
    this.hotReloader = dev ? this.getHotReloader() : null
    if (!dev && !fs.existsSync(resolve(dir, '.next', 'BUILD_ID'))) {
      console.error(`> Could not find a valid build in the '${'.next'}' directory! Try building your app with 'next build' before starting the server.`)
      process.exit(1)
    }
    const buildId = !dev ? this.readBuildId() : '-'
    const assetPrefix = (this.config.assetPrefix || '').replace(/\/$/, '')
    this.renderOpts = {
      dev,
      dir: this.dir,
      hotReloader: this.hotReloader,
      publicPath: `${assetPrefix}/_next/`,
      buildId,
      entrypoints: !dev ? this.readEntrypoints() : undefined
    }
  }

  renderPage (req, res, pathname, query, initialProps, { page, err, enhancer, overloadCheck } = {}) {
    return doPageRender(req, res, pathname, query, initialProps, {
      ...this.renderOpts,
      loadPage: this.loadPage,
      page,
      err,
      enhancer,
      overloadCheck
    })
  }

  renderDocument (page, initialProps, { amp } = {}) {
    return doDocRender(page, initialProps, {
      ...this.renderOpts,
      loadPage: this.loadPage,
      assets: this.assets,
      amp
    })
  }

  getHotReloader () {
    const { HotReloader } = require('@healthline/six-million')
    const createWebpack = require('./webpack').default
    return new HotReloader(this.dir, createWebpack, { query: this.quiet, config: this.config })
  }

  async prepare () {
    if (this.hotReloader) {
      await this.hotReloader.start(['_error', '_document', '_amp'])
    }
  }

  async close () {
    if (this.hotReloader) {
      await this.hotReloader.stop()
    }
  }

  defineRoutes (server) {
    // With assets, the consumer serves its own files.
    if (this.assets) return

    if (this.hotReloader) {
      server.route({
        method: 'GET',
        path: '/_next/webpack-hmr',
        handler: async ({ raw, url }, h) => {
          const { req, res } = raw
          res.statusCode = 200
          await this.hotReloader.run(req, res)
          return h.close
        }
      })
    }

    server.route({
      method: 'GET',
      path: '/_next/{path*}',
      handler: {
        directory: {
          path: '.next/bundles/'
        }
      }
    })
    server.route({
      method: 'GET',
      path: '/_static/{path*}',
      handler: {
        directory: {
          path: '.next/static/'
        }
      }
    })
  }

  readBuildId () {
    const buildIdPath = join(this.dir, '.next', 'BUILD_ID')
    return fs.readFileSync(buildIdPath, 'utf8').trim()
  }

  // VITE-MIGRATION(webpack-deletion): delete this, the `entrypoints` render
  // option, and the .next/BUILD_ID check and read once every site passes
  // `assets`; bin/next-build writes both files.
  readEntrypoints () {
    const buildIdPath = join(this.dir, '.next', 'webpack-entrypoints.json')
    const entrypoints = JSON.parse(fs.readFileSync(buildIdPath, 'utf8'))
    if (!entrypoints[process.env.SITE || 'default']) {
      throw new Error(`No entry points defined for SITE ${process.env.SITE}`)
    }

    return entrypoints[process.env.SITE || 'default']
  }

  async getCompilationError () {
    if (!this.hotReloader) return

    const errors = await this.hotReloader.getCompilationErrors()
    if (!errors.size) return

    // Return the very first error we found.
    return Array.from(errors.values())[0][0]
  }
}
