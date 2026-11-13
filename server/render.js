import { join } from 'path'
import { createElement } from 'react'
import { renderToString, renderToStaticMarkup } from 'react-dom/server'
import stripAnsi from 'strip-ansi'
import Head, { defaultHead } from '../lib/head'

export const $HEAD = Symbol.for('head')

export async function doPageRender (req, res, pathname, query, initialProps, {
  dev,
  err,
  publicPath,
  page,
  hotReloader,
  loadPage,
  dir,
  overloadCheck = () => false,
  enhancer = Page => Page
}) {
  pathname = pathname.replace(/\/index/, '') || '/index'
  page = page || pathname

  const Component = await loadComponent(page, { dir, hotReloader, loadPage })

  const asPath = req.url
  const props = initialProps || await Component.getInitialProps({ err, req, res, pathname, query, asPath })

  if (overloadCheck()) {
    return {
      pathname,
      query,
      props,
      head: props[$HEAD] || renderToString(defaultHead)
    }
  }

  const app = createElement(enhancer(Component), { url: asPath, ...props })

  let html
  let head
  let errorHtml

  try {
    if (err) {
      errorHtml = renderToString(app)
    } else {
      html = renderToString(app)
    }
  } finally {
    head = props[$HEAD] || renderToString(Head.rewind() || defaultHead)
  }

  return {
    err: serializeError(dev, err),
    pathname,
    query,
    props,
    head,
    html,
    publicPath,
    errorHtml
  }
}

export async function doDocRender (page, initialProps, { amp, dev, dir, publicPath, entrypoints, assets, hotReloader, buildId, loadPage }) {
  const Document = await loadComponent(amp ? '_amp' : '_document', { dir, loadPage })

  const docProps = await Document.getInitialProps({ initialProps, renderPage: () => page })
  // Seed renders have no page pathname. Their Document still supplies the browser data.
  const usePageData = Boolean(assets && page.pathname)
  const renderData = usePageData ? page : docProps
  const nextData = {
    buildId,
    props: renderData.props,
    pathname: renderData.pathname,
    query: renderData.query,
    publicPath: docProps.publicPath || publicPath,
    err: renderData.err
  }
  const doc = createElement(Document, {
    __NEXT_DATA__: nextData,
    // Keep caller-supplied entrypoints as a per-route fallback during migration.
    // VITE-MIGRATION(webpack-deletion): the dev fallback reads webpack's
    // compilation; delete it with client/next-dev.js.
    entrypoints:
      entrypoints ||
      (assets && {}) ||
      hotReloader.multiStats.stats.reduce((prev, { compilation }) => {
        for (let [entryName, entrypoint] of compilation.entrypoints.entries()) {
          const path = prev[entryName] = prev[entryName] = prev[entryName] || { chunks: [] }
          path.chunks.push(
            ...entrypoint.chunks
              .reduce((prev, { files }) => prev.concat(files), [])
              .filter(name => !/\.map$/.test(name) && !/hot-update.js/.test(name))
              .map(file => ({
                file,
                module: true
              }))
          )
        }
        return prev
      }, {}),
    dev,
    ...docProps,
    ...(usePageData ? { __NEXT_DATA__: nextData } : {}),
    // A Document cannot replace the assets checked at startup.
    assets
  })

  return '<!DOCTYPE html>' + renderToStaticMarkup(doc)
}

export function serializeError (dev, err) {
  if (!err) {
    return undefined
  }
  if (err.output && err.output.payload) {
    return err.output.payload
  }
  if (err.status) {
    return { name: err.name, message: err.message, status: err.status }
  }
  if (dev) {
    const { name, message, stack } = err
    const json = { name, message: stripAnsi(message), stack: stripAnsi(stack) }

    if (err.module) {
      // rawRequest contains the filename of the module which has the error.
      const { rawRequest } = err.module
      json.module = { rawRequest }
    }

    return json
  }

  return { message: '500 - Internal Server Error.' }
}

async function ensurePage (page, { dir, hotReloader }) {
  if (!hotReloader) return
  if (page === '_error' || page === '_document' || page === '_amp') return

  await hotReloader.ensurePage(page)
}

async function loadComponent (page, { dir, hotReloader, loadPage }) {
  if (loadPage) return loadPage(page.startsWith('/') ? page : `/${page}`)

  // VITE-MIGRATION(server-tree-switch): keep filesystem loading for callers
  // that have not supplied their own loader.
  await ensurePage(page, { dir, hotReloader })
  const loaded = require(join(dir, '.next', 'server', 'pages', page))
  return loaded.default || loaded
}
