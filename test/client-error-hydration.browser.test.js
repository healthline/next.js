/* global document */

// When the server sends its error page, renderError's unmount finds nothing
// mounted, so the error page hydrates the server's markup like any page.
// React 16 only warns on a mismatch, so the test also checks console.error got
// nothing but the error renderError reports.

const STATUS_CODE = 500
const ERROR_MARKUP = `<span id="error">error:${STATUS_CODE}</span>`

describe('the client entry, handed an error and its markup by the server', () => {
  let consoleError

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('adopts the error markup the server sent instead of rendering the page', async () => {
    // A plain object, the way it survives __NEXT_DATA__ serialization.
    const err = { message: 'the server failed to render', statusCode: STATUS_CODE }
    global.__NEXT_DATA__ = {
      props: {},
      err,
      pathname: '/',
      query: {},
      publicPath: '/_next/'
    }
    document.body.innerHTML = `<div id="__next">${ERROR_MARKUP}</div>`
    // Captured before the entry runs, so an adopted node is distinguishable
    // from a replacement.
    const serverRenderedNode = document.getElementById('error')

    const { createElement } = require('react')
    const { registerPage } = require('../lib/page-loader')
    // `next/client` is unreachable through its alias under Jest, so the entry
    // is required relatively.
    const client = require('../client/index')

    const Page = () => createElement('span', { id: 'page' }, 'page')
    Page.getInitialProps = async () => ({})

    const errorPageClicks = jest.fn()
    const ErrorPage = ({ statusCode }) =>
      createElement('span', { id: 'error', onClick: errorPageClicks }, `error:${statusCode}`)
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

    expect(document.getElementById('error')).toBe(serverRenderedNode)
    expect(serverRenderedNode.isConnected).toBe(true)
    expect(serverRenderedNode.textContent).toBe(`error:${STATUS_CODE}`)
    expect(document.getElementById('page')).toBeNull()
    expect(consoleError.mock.calls).toEqual([[err]])

    // An inert server node passes every check above; only a hydrated one runs the handler.
    serverRenderedNode.click()
    expect(errorPageClicks).toHaveBeenCalledTimes(1)
  })
})
