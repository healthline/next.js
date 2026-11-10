/* global document */

// renderError must tear the mounted app down before it renders the error page,
// because the component that just threw can be left half-rendered.
//
// One component serves both routes. With different component types React
// would replace the tree on its own; with the same type in the same position
// it would reconcile, reusing the DOM node and skipping componentWillUnmount,
// so only a real unmount produces a fresh node.
//
// The container starts empty, so the first render is a plain render. The
// entry is required relatively because the `next/client` alias does not
// resolve under Jest.

const ERROR_MESSAGE = 'the page component threw'

describe('the client entry, rendering an error page over a live app', () => {
  let consoleError

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('unmounts the mounted page before rendering the error page, and reports the error it was handed', async () => {
    global.__NEXT_DATA__ = {
      props: {},
      err: null,
      pathname: '/',
      query: {},
      publicPath: '/_next/'
    }
    document.body.innerHTML = '<div id="__next"></div>'

    const { createElement, Component } = require('react')
    const { registerPage } = require('../lib/page-loader')
    const client = require('../client/index')

    const unmountedPages = []

    class Page extends Component {
      componentWillUnmount () {
        unmountedPages.push(this.props.err ? 'error' : 'page')
      }

      render () {
        const { err } = this.props
        return createElement(
          'span',
          { id: err ? 'error' : 'page' },
          err ? `error:${err.message}` : 'page'
        )
      }
    }
    // renderError calls .then on this, so it has to return a thenable.
    Page.getInitialProps = async ({ err } = {}) => ({ err })

    registerPage('/', () => ({ page: Page }))
    registerPage('/_error', () => ({ page: Page }))

    const firstRender = new Promise((resolve) => {
      client.emitter.on('after-reactdom-render', resolve)
    })
    await client.default()
    await firstRender
    // renderError has a mounted page to tear down only once the first render is done.
    expect(document.getElementById('__next').innerHTML).toBe('<span id="page">page</span>')
    const pageNode = document.getElementById('page')

    await client.renderError(new Error(ERROR_MESSAGE))

    expect(document.getElementById('error').textContent).toBe(
      `error:${ERROR_MESSAGE}`
    )
    expect(unmountedPages).toEqual(['page'])
    expect(pageNode.isConnected).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: ERROR_MESSAGE })
    )
  })
})
