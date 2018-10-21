import React, { Component, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PropTypes from 'prop-types'
import htmlescape from 'htmlescape'

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
      `<link rel="preload" href="${publicPath}${filename}" as='script' >`
    )
  }

  getPreloadMainLinks () {
    // In the production mode, we have a single asset with all the JS content.
    return [
      this.getChunkPreloadLink('vendor.js')
    ]
  }

  render () {
    const { head, styles, __NEXT_DATA__ } = this.context._documentProps
    const { pathname, publicPath } = __NEXT_DATA__
    const pagePathname = getPagePathname(pathname)

    const { children, ...rest} = this.props

    return <head {...rest} dangerouslySetInnerHTML={{
      __html: `
<link rel="preload" href="${publicPath}pages${pagePathname}.js" as="script">
${this.getPreloadMainLinks()}
${head || ''}
${renderToStaticMarkup(
  <Fragment>
    {styles || null}
    {children}
  </Fragment>
)}
    `}} />
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
    nonce: PropTypes.string,
    commonChunks: PropTypes.array
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
    // In the production mode, we have a single asset with all the JS content.
    // So, we can load the script with async
    return ['vendor.js'].concat(this.props.commonChunks || []).map(name => this.getChunkScript(name, { async: true }))
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
