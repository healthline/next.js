import React, { Component } from 'react'
import PropTypes from 'prop-types'
import htmlescape from 'htmlescape'

export default class Document extends Component {
  static getInitialProps ({ renderPage }) {
    const { html, head, errorHtml, chunks } = renderPage()
    return { html, head, errorHtml, chunks }
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
    const { __NEXT_DATA__ } = this.context._documentProps
    let { buildStats, assetPrefix, buildId } = __NEXT_DATA__
    const hash = buildStats ? buildStats[filename].hash : buildId

    return (
      <link
        key={filename}
        rel='preload'
        href={`${assetPrefix}/_next/${hash}/${filename}`}
        as='script'
      />
    )
  }

  getPreloadMainLinks () {
    // In the production mode, we have a single asset with all the JS content.
    return [
      this.getChunkPreloadLink('vendor.js')
    ]
  }

  getPreloadDynamicChunks () {
    const { chunks, __NEXT_DATA__ } = this.context._documentProps
    let { assetPrefix, buildId } = __NEXT_DATA__
    return chunks.map((chunk) => (
      <link
        key={chunk}
        rel='preload'
        href={`${assetPrefix}/_next/${buildId}/chunks/${chunk}`}
        as='script'
      />
    ))
  }

  render () {
    const { head, styles, __NEXT_DATA__ } = this.context._documentProps
    const { pathname, buildId, assetPrefix } = __NEXT_DATA__
    const pagePathname = getPagePathname(pathname)

    return <head {...this.props}>
      <link rel='preload' href={`${assetPrefix}/_next/${buildId}/pages${pagePathname}.js`} as='script' />
      {this.getPreloadDynamicChunks()}
      {this.getPreloadMainLinks()}
      {(head || []).map((h, i) => React.cloneElement(h, { key: i }))}
      {styles || null}
      {this.props.children}
    </head>
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
    const { __NEXT_DATA__ } = this.context._documentProps
    let { buildStats, assetPrefix, buildId } = __NEXT_DATA__
    const hash = buildStats ? buildStats[filename].hash : buildId

    return (
      <script
        key={filename}
        type='text/javascript'
        src={`${assetPrefix}/_next/${hash}/${filename}`}
        {...additionalProps}
      />
    )
  }

  getScripts () {
    // In the production mode, we have a single asset with all the JS content.
    // So, we can load the script with async
    return [this.getChunkScript('vendor.js', { async: true })]
  }

  render () {
    const { __NEXT_DATA__ } = this.context._documentProps
    const { pathname, buildId, assetPrefix } = __NEXT_DATA__
    const pagePathname = getPagePathname(pathname)

    return <div>
      <script nonce={this.props.nonce} dangerouslySetInnerHTML={{
        __html: `module={};__NEXT_DATA__ = ${htmlescape(__NEXT_DATA__)}`
      }} />
      <script async id={`__NEXT_PAGE__${pathname}`} type='text/javascript' src={`${assetPrefix}/_next/${buildId}/pages${pagePathname}.js`} />
      {this.getScripts()}
    </div>
  }
}

function getPagePathname (pathname) {
  if (pathname === '/') return '/index'
  return pathname.replace(/(\/index)?\.js$/, '')
}
