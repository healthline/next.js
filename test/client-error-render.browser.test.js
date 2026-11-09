/* global document */

// renderError must tear the mounted app down before it renders the error page,
// because the component that just threw is in an inconsistent state and an
// HMR-delivered fix has to re-render from nothing.
//
// One component serves both routes. With different component types React
// would replace the tree on its own; with the same type in the same position
// it would reconcile, reusing the DOM node and skipping componentWillUnmount,
// so only a real unmount produces a fresh node.
//
// `next/client` is unreachable through its alias under Jest, so the entry is
// required relatively. The container starts empty so the first render is an
// ordinary render rather than a hydration.

const ERROR_MESSAGE = 'the page component threw'

describe('the client entry, rendering an error page over a live app', () => {
  let consoleError

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('unmounts the app that threw, renders the error page, and reports the error', async () => {
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
    // renderError awaits this, so it has to be a thenable.
    Page.getInitialProps = async ({ err } = {}) => ({ err })

    registerPage('/', () => ({ page: Page }))
    registerPage('/_error', () => ({ page: Page }))

    await client.default()
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
