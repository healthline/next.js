import React, { Component, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PropTypes from 'prop-types'
import htmlescape from 'htmlescape'

// Head joins its link tags into one HTML string, so React does not escape them.
const escapeAttribute = (value) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// VITE-MIGRATION(webpack-deletion): delete this and the webpack branches of
// getPreloadMainLinks and getScripts once every route is in the assets.
function scriptsForEntry (pathname, entrypoints) {
  const entry = entrypoints[`pages${pathname}.js`]

  if (entry) {
    return entry.chunks
      .reduce((prev, { file, module }) => prev.concat({ file, module }), [])
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
    const { __NEXT_DATA__, entrypoints, assets } = this.context._documentProps
    const { pathname } = __NEXT_DATA__

    if (assets) {
      // NextScript reports a route the assets do not name.
      const page = assets.pages[pathname]
      if (!page) return ''
      const link = (rel) => (url) => `<link rel="${rel}" href="${escapeAttribute(url)}" crossorigin="anonymous">`
      return page.stylesheets.map(link('stylesheet'))
        .concat(page.preloads.map(link('modulepreload')))
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
    const { __NEXT_DATA__, entrypoints, assets } = this.context._documentProps
    const { pathname } = __NEXT_DATA__

    if (assets) {
      const page = assets.pages[pathname]
      return page ? [<script key={page.entry} type='module' src={page.entry} crossOrigin='anonymous' />] : []
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
    const { __NEXT_DATA__, assets } = this.context._documentProps
    const { pathname } = __NEXT_DATA__

    const scripts = this.getScripts()
    // With assets, /_error is a route like any other.
    // VITE-MIGRATION(webpack-deletion): without assets, /_error is exempt, so
    // an error page with no scripts renders silently. Delete the exemption
    // with webpack.
    if (!scripts.length && (assets || pathname !== '/_error')) {
      throw new Error(
        `No scripts found for ${pathname}. Please check path`
      )
    }

    return <Fragment>
      <script nonce={this.props.nonce} dangerouslySetInnerHTML={{
        __html: `module={};__NEXT_DATA__=${htmlescape(__NEXT_DATA__)}`
      }} />
      {scripts}
    </Fragment>
  }
}
