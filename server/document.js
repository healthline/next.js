import React, { Component, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PropTypes from 'prop-types'
import htmlescape from 'htmlescape'
import { posix } from 'path'
import { isServableChunk } from './chunks'

// A page's Vite entry is the entry chunk named after the page. The site's Vite
// build names each page input the way webpack names the page's entry, minus
// the extension (`pages/home-page` for `pages/home-page.js`), and Vite's
// manifest records that input name as the chunk's `name`. Manifest keys are
// source paths, which say nothing about the page.
function viteEntryKey (pathname, viteManifest) {
  if (!viteManifest) {
    return undefined
  }

  const { manifest } = viteManifest
  const name = `pages${pathname}`
  return Object.keys(manifest).find((key) =>
    manifest[key].isEntry && manifest[key].name === name
  )
}

// Whether the page loads the site's Vite build. Webpack still builds every
// page too, but a route loads exactly one chunk set.
function isVitePage (pathname, viteManifest) {
  return viteEntryKey(pathname, viteManifest) !== undefined
}

// The `importedChunks` function of Vite's backend-integration guide
// (vitejs/vite v8.0.10, docs/guide/backend-integration.md), unchanged: the
// chunks an entry imports statically, followed recursively, each once. It does
// not follow `dynamicImports`; those chunks load when the page imports them.
function importedChunks (manifest, name) {
  const seen = new Set()

  function getImportedChunks (chunk) {
    const chunks = []
    for (const file of chunk.imports || []) {
      const importee = manifest[file]
      if (seen.has(file)) {
        continue
      }
      seen.add(file)

      chunks.push(...getImportedChunks(importee))
      chunks.push(importee)
    }

    return chunks
  }

  return getImportedChunks(manifest[name])
}

// A Vite page's files, as paths under publicPath, in the guide's order:
// stylesheets of the entry and then of each imported chunk, the entry itself,
// and the imported chunks to preload. The manifest's `file` names are relative
// to the build's outDir, which the site's build records relative to
// .next/bundles, the directory publicPath serves.
function viteAssets (pathname, viteManifest) {
  const { outDir, manifest } = viteManifest
  const key = viteEntryKey(pathname, viteManifest)
  const entry = manifest[key]
  const imported = importedChunks(manifest, key)
  const underOutDir = (file) => posix.join(outDir, file)

  return {
    stylesheets: [entry, ...imported]
      .reduce((files, chunk) => files.concat(chunk.css || []), [])
      .map(underOutDir),
    entry: underOutDir(entry.file),
    preloads: imported.map((chunk) => underOutDir(chunk.file))
  }
}

function scriptsForEntry (pathname, entrypoints) {
  const entry = entrypoints[`pages${pathname}.js`]

  if (entry) {
    return entry.chunks
      .reduce((prev, { file, module }) => prev.concat({ file, module }), [])
      // `file`, not `name`: a manifest chunk is { file, module }, so the
      // predicate this filter replaces tested undefined and matched nothing.
      // The exclusion set is shared with server/render.js; server/chunks.js
      // says what it excludes and why the document filters its own input.
      .filter(({ file }) => isServableChunk(file))
  } else {
    return []
  }
}

export default class Document extends Component {
  static getInitialProps ({ renderPage }) {
    const { html, head, errorHtml } = renderPage()
    return { html, head, errorHtml }
  }

  static childContextTypes = {
    _documentProps: PropTypes.any
  };

  getChildContext () {
    return { _documentProps: this.props }
  }

  render () {
    return <html>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </html>
  }
}

export class Head extends Component {
  static contextTypes = {
    _documentProps: PropTypes.any
  }

  getChunkPreloadLink ({ file, module }) {
    let { publicPath } = this.context._documentProps.__NEXT_DATA__

    // Give preference to modern bundle for preloading (since we can't do nomodule for
    // legacy vs. not and browsers will download both)
    return module
      ? `<link rel=preload href="${publicPath}${file}" as=script crossorigin=anonymous>`
      : ''
  }

  getPreloadMainLinks () {
    const { __NEXT_DATA__, entrypoints, viteManifest } = this.context._documentProps
    const { pathname, publicPath } = __NEXT_DATA__

    // `crossorigin` as on the webpack tags, and as Vite's own HTML build
    // writes it on stylesheet and modulepreload links.
    if (isVitePage(pathname, viteManifest)) {
      const { stylesheets, preloads } = viteAssets(pathname, viteManifest)
      return stylesheets
        .map((file) => `<link rel="stylesheet" href="${publicPath}${file}" crossorigin="anonymous">`)
        .concat(preloads.map((file) => `<link rel="modulepreload" href="${publicPath}${file}" crossorigin="anonymous">`))
        .join('')
    }

    let scripts = scriptsForEntry(pathname, entrypoints)

    // In the production mode, we have a single asset with all the JS content.
    return scripts.map((name) => this.getChunkPreloadLink(name)).join('')
  }

  render () {
    const { head, styles } = this.context._documentProps
    const { children, amp, ...rest } = this.props

    const headMarkup = renderToStaticMarkup(
      <Fragment>
        {styles || null}
        {children}
      </Fragment>
    )

    return <head {...rest} dangerouslySetInnerHTML={{
      __html: `
${amp ? '' : this.getPreloadMainLinks()}
${head || ''}
${headMarkup}
    ` }} />
  }
}

export class Main extends Component {
  static propTypes = {
    className: PropTypes.string
  }

  static contextTypes = {
    _documentProps: PropTypes.any
  }

  render () {
    const { html, errorHtml } = this.context._documentProps
    const { className } = this.props
    return (
      <div id='__next' className={className} dangerouslySetInnerHTML={{ __html: errorHtml || html }} />
    )
  }
}

export class NextScript extends Component {
  static propTypes = {
    nonce: PropTypes.string
  }

  static contextTypes = {
    _documentProps: PropTypes.any
  }

  getScripts () {
    const { __NEXT_DATA__, entrypoints, viteManifest } = this.context._documentProps
    const { pathname } = __NEXT_DATA__

    // One module script, the entry; the browser fetches what it imports. No
    // `async`: Vite's own HTML build adds it only where the source HTML's
    // script had it.
    if (isVitePage(pathname, viteManifest)) {
      const { publicPath } = __NEXT_DATA__
      const { entry } = viteAssets(pathname, viteManifest)
      return [
        <script
          key={entry}
          type='module'
          src={`${publicPath}${entry}`}
          crossOrigin='anonymous'
        />
      ]
    }

    let scripts = scriptsForEntry(pathname, entrypoints)

    // In the production mode, we have a single asset with all the JS content.
    // So, we can load the script with async
    return scripts.map(({ file, module }) => {
      let { publicPath } = this.context._documentProps.__NEXT_DATA__

      if (!module) {
        return
      }

      return (
        <script
          key={file}
          type={module ? 'module' : 'text/javascript'}
          src={`${publicPath}${file}`}
          crossOrigin='anonymous'
          async
        />
      )
    }).filter(Boolean)
  }

  render () {
    const { __NEXT_DATA__ } = this.context._documentProps
    const { pathname } = __NEXT_DATA__

    const scripts = this.getScripts()
    if (!scripts.length && pathname !== '/_error') {
      throw new Error(
        `No scripts found for ${pathname}. Please check path`
      )
    }

    // The only job of this inline script is to put __NEXT_DATA__ on the page
    // before any bundle runs. It also used to assign a global `module = {}`,
    // which nothing read: it existed only so that an unguarded `module.hot`
    // lookup in the page loader would find an object instead of throwing.
    // The page loader now guards that lookup with `typeof module !== 'undefined'`
    // (lib/page-loader.js), so the shim is dead -- and worse than dead,
    // because while it stayed, any new unguarded `module.*` read on the
    // hydration path would work in the browser and fail only under an ESM
    // bundle, which is the toolchain @healthline/next is moving to.
    return <Fragment>
      <script nonce={this.props.nonce} dangerouslySetInnerHTML={{
        __html: `__NEXT_DATA__=${htmlescape(__NEXT_DATA__)}`
      }} />
      {scripts}
    </Fragment>
  }
}
