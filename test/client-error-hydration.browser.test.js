/* global document */

// The server can hand the client an error: it renders the error page, puts the
// markup in the container, and sets __NEXT_DATA__.err. The entry then reaches
// renderError before it has rendered anything itself, and renderError begins by
// unmounting the container -- which does nothing, because React never mounted
// into it (ReactDOM.unmountComponentAtNode returns false for a container it
// does not own). So the error page's first render is an ordinary first render:
// it adopts the server's error markup by hydration, exactly as a normal page
// would.
//
// That is the behavior this suite pins. It was reachable in 26.1.1 too but no
// test drove it through the entry, so nothing said whether the error page
// adopts the markup or replaces it, and nothing would have caught the adoption
// happening over markup it disagrees with.
//
// Two things make the assertions mean something.
//
// No console.error spy is installed here, even though renderError reports the
// error through it. Spying would replace the wrapper that
// test/setup/fail-on-hydration-warning.js installs and so suspend the project
// hydration guard for this suite -- and the guard is half of what is being
// asserted: React 16 keeps the server's nodes on a mismatch and only warns, so
// the identity assertion alone would pass over broken hydration. The cost is
// the reported error appearing in this suite's output.
//
// The page and the error page render different markup, so a run where the
// error page was not the thing rendered is visible rather than silently
// equivalent.

const STATUS_CODE = 500
const ERROR_MARKUP = `<span id="error">error:${STATUS_CODE}</span>`

describe('the client entry, handed an error and its markup by the server', () => {
  let serverRenderedNode

  beforeAll(async () => {
    global.__NEXT_DATA__ = {
      props: {},
      // A plain object, the way it survives __NEXT_DATA__ serialization.
      err: { message: 'the server failed to render', statusCode: STATUS_CODE },
      pathname: '/',
      query: {},
      publicPath: '/_next/'
    }
    document.body.innerHTML = `<div id="__next">${ERROR_MARKUP}</div>`
    // Captured before the entry runs, so an adopted node is distinguishable
    // from a replacement.
    serverRenderedNode = document.getElementById('error')

    // A fresh react-dom: the hydration warning is gated on a module-level flag
    // that no later hydration resets. See the setup file.
    jest.resetModules()

    const { createElement } = require('react')
    const { registerPage } = require('../lib/page-loader')
    // `next/client` is unreachable through its alias under Jest, so the entry
    // is required relatively.
    const client = require('../client/index')

    const Page = () => createElement('span', { id: 'page' }, 'page')
    Page.getInitialProps = async () => ({})

    const ErrorPage = ({ statusCode }) =>
      createElement('span', { id: 'error' }, `error:${statusCode}`)
    ErrorPage.getInitialProps = async ({ err }) => ({
      statusCode: err.statusCode
    })

    registerPage('/', () => ({ page: Page }))
    registerPage('/_error', () => ({ page: ErrorPage }))

    // The entry calls render() without awaiting it, and renderError awaits
    // getInitialProps, so the render is not finished when default() resolves.
    const rendered = new Promise((resolve) => {
      client.emitter.on('after-reactdom-render', resolve)
    })
    await client.default()
    await rendered
  })

  it('renders the error page rather than the page for the route', () => {
    expect(document.getElementById('error').textContent).toBe(
      `error:${STATUS_CODE}`
    )
    expect(document.getElementById('page')).toBeNull()
  })

  it('adopts the error markup the server sent instead of replacing it', () => {
    // Hydration reuses the server's node. A plain render would have discarded
    // it and built a new one, and the container would be holding a node this
    // test never saw.
    expect(document.getElementById('error')).toBe(serverRenderedNode)
    expect(serverRenderedNode.isConnected).toBe(true)
  })
})
