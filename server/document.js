import React, { Component, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PropTypes from 'prop-types'
import htmlescape from 'htmlescape'

function scriptsForEntry (pathname, entrypoints) {
  const entry = entrypoints.get(`pages${pathname}.js`)

  if (entry) {
    return entry.chunks.reduce((prev, { files }) => prev.concat(files), [])
  } else {
    return ['vendor.js']
  }
}

export default class Document extends Component {
  static getInitialProps ({ renderPage }) {
    const { html, head, errorHtml } = renderPage()
    return { html, head, errorHtml }
  }

  static childContextTypes = {
    _documentProps: PropTypes.any
  }

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

  getChunkPreloadLink (filename) {
    let { publicPath } = this.context._documentProps.__NEXT_DATA__

    return (
      `<link rel=preload href="${publicPath}${filename}" as=script>`
    )
  }

  getPreloadMainLinks () {
    const { __NEXT_DATA__, entrypoints } = this.context._documentProps
    const { pathname } = __NEXT_DATA__

    let scripts = scriptsForEntry(pathname, entrypoints)

    // In the production mode, we have a single asset with all the JS content.
    return scripts.map((name) => this.getChunkPreloadLink(name)).join('')
  }

  render () {
    const { head, styles } = this.context._documentProps
    const { children, ...rest } = this.props

    const headMarkup = renderToStaticMarkup(
      <Fragment>
        {styles || null}
        {children}
      </Fragment>
    )

    return <head {...rest} dangerouslySetInnerHTML={{
      __html: `
${this.getPreloadMainLinks()}
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
      <div className={className}>
        <div id='__next' dangerouslySetInnerHTML={{ __html: html }} />
        <div id='__next-error' dangerouslySetInnerHTML={{ __html: errorHtml }} />
      </div>
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

  getChunkScript (filename, additionalProps = {}) {
    let { publicPath } = this.context._documentProps.__NEXT_DATA__

    return (
      <script
        key={filename}
        type='text/javascript'
        src={`${publicPath}${filename}`}
        {...additionalProps}
      />
    )
  }

  getScripts () {
    const { __NEXT_DATA__, entrypoints } = this.context._documentProps
    const { pathname } = __NEXT_DATA__

    let scripts = scriptsForEntry(pathname, entrypoints)

    // In the production mode, we have a single asset with all the JS content.
    // So, we can load the script with async
    return scripts.map(name => this.getChunkScript(name, { async: true }))
  }

  render () {
    const { __NEXT_DATA__ } = this.context._documentProps
    const { pathname, publicPath } = __NEXT_DATA__
    const pagePathname = getPagePathname(pathname)

    return <div>
      <script nonce={this.props.nonce} dangerouslySetInnerHTML={{
        __html: `module={};__NEXT_DATA__ = ${htmlescape(__NEXT_DATA__)}`
      }} />
      <script async id={`__NEXT_PAGE__${pathname}`} type='text/javascript' src={`${publicPath}pages${pagePathname}.js`} />
      {this.getScripts()}
    </div>
  }
}

function getPagePathname (pathname) {
  if (pathname === '/') return '/index'
  return pathname.replace(/(\/index)?\.js$/, '')
}
