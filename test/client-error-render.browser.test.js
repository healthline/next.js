/* global document */

// renderError must tear the mounted app down before it renders the error page,
// because the component that just threw is in an inconsistent state and an
// HMR-delivered fix has to re-render from nothing.
//
// Observing a teardown takes care. If the page and the error page were
// different component types, React would replace the tree on its own and the
// test would pass with or without the unmount. So one component serves both
// routes here: same element type in the same position means React would
// otherwise reconcile it -- reusing the DOM node and skipping
// componentWillUnmount -- and only a real unmount can produce a fresh node.
//
// `next/client` is unreachable through its alias under Jest, so the entry is
// required relatively. The container starts empty so the first render is an
// ordinary render rather than a hydration.
//
// The console.error spy below suspends the project's hydration guard
// (test/setup/fail-on-hydration-warning.js) from the moment it is installed
// until afterAll restores it, because the guard works by wrapping
// console.error. Nothing is hidden by that: the guard is still in place for
// the initial render, and the container starts empty, so this suite performs
// no hydration at all. The first test asserts that precondition rather than
// leaving it to the reader.

const ERROR_MESSAGE = 'the page component threw'

describe('the client entry, rendering an error page over a live app', () => {
  let pageNode
  let unmountedPages
  let consoleError
  let client
  let containerWasEmpty

  beforeAll(async () => {
    global.__NEXT_DATA__ = {
      props: {},
      err: null,
      pathname: '/',
      query: {},
      publicPath: '/_next/'
    }
    document.body.innerHTML = '<div id="__next"></div>'
    // Read before the entry runs: the entry renders into this container.
    containerWasEmpty = document.getElementById('__next').firstChild === null

    const { createElement, Component } = require('react')
    const { registerPage } = require('../lib/page-loader')
    client = require('../client/index')

    unmountedPages = []

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
    pageNode = document.getElementById('page')

    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    await client.renderError(new Error(ERROR_MESSAGE))
  })

  afterAll(() => {
    consoleError.mockRestore()
  })

  it('starts from an empty container, so no render here is a hydration', () => {
    // The console.error spy this suite installs suspends the project's
    // hydration guard. That is only safe while this precondition holds.
    expect(containerWasEmpty).toBe(true)
  })

  it('renders the error page', () => {
    expect(document.getElementById('error').textContent).toBe(
      `error:${ERROR_MESSAGE}`
    )
  })

  it('removes the app that threw from the document instead of reconciling over it', () => {
    expect(pageNode.isConnected).toBe(false)
    expect(document.getElementById('error')).not.toBe(pageNode)
  })

  it('unmounts the app that threw before the error page mounts', () => {
    expect(unmountedPages).toEqual(['page'])
  })

  it('reports the error to the console', () => {
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: ERROR_MESSAGE })
    )
  })
})
