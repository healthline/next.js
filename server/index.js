import { resolve, join, posix } from 'path'
import fs from 'fs'

import getConfig from './config'

export default class Server {
  constructor ({ dir = '.', dev = false, quiet = false, conf = null } = {}) {
    this.dir = resolve(dir)
    this.dev = dev
    this.quiet = quiet
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
      entrypoints: !dev ? this.readEntrypoints() : undefined,
      viteManifest: !dev ? this.readViteManifest(buildId) : undefined
    }
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

  readEntrypoints () {
    const buildIdPath = join(this.dir, '.next', 'webpack-entrypoints.json')
    const entrypoints = JSON.parse(fs.readFileSync(buildIdPath, 'utf8'))
    if (!entrypoints[process.env.SITE || 'default']) {
      throw new Error(`No entry points defined for SITE ${process.env.SITE}`)
    }

    return entrypoints[process.env.SITE || 'default']
  }

  // The site's Vite build output, when the site's build took any page through
  // Vite. The build writes one file per site, beside this build's other
  // outputs rather than under .next/bundles, which is uploaded:
  //
  //   .next/vite-manifests/<BUILD_ID>-<site>.json
  //   { "outDir": "<the Vite build's build.outDir, relative to .next/bundles>",
  //     "manifest": <the build's .vite/manifest.json, verbatim> }
  //
  // outDir is where the manifest's file names start, so a URL is publicPath,
  // outDir, then the file. The build is the one place that says where its
  // output lives. Because the name carries BUILD_ID, a file an earlier build
  // left in .next is not read. No file means the site has no Vite pages.
  readViteManifest (buildId) {
    const site = process.env.SITE || 'default'
    const path = join(this.dir, '.next', 'vite-manifests', `${buildId}-${site}.json`)
    if (!fs.existsSync(path)) {
      return undefined
    }

    const { outDir, manifest } = JSON.parse(fs.readFileSync(path, 'utf8'))
    const outDirIsUnderBundles = typeof outDir === 'string' &&
      !posix.isAbsolute(outDir) &&
      !outDir.split('/').includes('..')
    if (!outDirIsUnderBundles || typeof manifest !== 'object' || manifest === null) {
      throw new Error(
        `${path} must be { outDir, manifest }: outDir is the Vite build's ` +
        'build.outDir relative to .next/bundles, manifest is its .vite/manifest.json'
      )
    }

    validateViteChunks(path, manifest)
    return { outDir, manifest }
  }

  async getCompilationError () {
    if (!this.hotReloader) return

    const errors = await this.hotReloader.getCompilationErrors()
    if (!errors.size) return

    // Return the very first error we found.
    return Array.from(errors.values())[0][0]
  }
}

// The keys of a chunk the document dereferences: `file`, `css`, and `imports`,
// each of which names another chunk the document follows. A chunk that breaks
// this would crash a page's render, so the server refuses it at startup.
function validateViteChunks (path, manifest) {
  const fail = (key, problem) => {
    throw new Error(`${path}: manifest chunk ${JSON.stringify(key)} ${problem}`)
  }
  const isStringArray = (value) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')

  for (const [key, chunk] of Object.entries(manifest)) {
    if (typeof chunk !== 'object' || chunk === null) {
      fail(key, 'is not an object')
    }
    if (typeof chunk.file !== 'string') {
      fail(key, 'has no string `file`')
    }
    if (chunk.css !== undefined && !isStringArray(chunk.css)) {
      fail(key, 'has a `css` that is not an array of strings')
    }
    if (chunk.imports !== undefined) {
      if (!isStringArray(chunk.imports)) {
        fail(key, 'has an `imports` that is not an array of strings')
      }
      for (const imported of chunk.imports) {
        if (!Object.prototype.hasOwnProperty.call(manifest, imported)) {
          fail(key, `imports ${JSON.stringify(imported)}, which is not a key in the manifest`)
        }
      }
    }
  }
}
