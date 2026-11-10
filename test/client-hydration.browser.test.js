/* global document */

// React 16 does not throw on a hydration mismatch: it keeps the server's nodes
// and warns through console.error. So the first-render tests check that
// console.error stayed silent, and the adoption test also checks that the
// server's node survived.
//
// The entry reads __NEXT_DATA__ and #__next as its module body runs, so both
// are set up before it is required. It is required relatively because the
// `next/client` alias does not resolve under Jest.

const PAGE_MARKUP = '<span id="marker">marker:1</span>'

const bootClient = async ({ containerHTML }) => {
  global.__NEXT_DATA__ = {
    props: { label: 'marker' },
    err: null,
    pathname: '/',
    query: {},
    publicPath: '/_next/'
  }
  document.body.innerHTML = `<div id="__next">${containerHTML}</div>`
  // Captured before the entry runs, so a test can tell an adopted node from a
  // replacement. Null when the container starts empty.
  const serverRenderedNode = document.getElementById('marker')

  // React 16 warns about a hydration mismatch once per react-dom instance, so
  // each boot needs a fresh module registry for its warning to be observable.
  jest.resetModules()

  const { createElement } = require('react')
  const { registerPage } = require('../lib/page-loader')
  const client = require('../client/index')
  const Router = require('../client/router').default

  // The page renders the markup the server sent for the initial query, and a
  // different one once the router reports a new query.
  const Page = ({ url, label }) =>
    createElement('span', { id: 'marker' }, `${label}:${url.query.n || '1'}`)
  Page.getInitialProps = () => ({})

  const ErrorPage = () =>
    createElement('span', { id: 'error-marker' }, 'error page')
  ErrorPage.getInitialProps = () => ({})

  registerPage('/', () => ({ page: Page }))
  registerPage('/_error', () => ({ page: ErrorPage }))

  const nextRender = () =>
    new Promise((resolve) => {
      const done = () => {
        client.emitter.off('after-reactdom-render', done)
        resolve()
      }
      client.emitter.on('after-reactdom-render', done)
    })

  const firstRender = nextRender()
  await client.default()
  await firstRender

  return { Router, nextRender, serverRenderedNode }
}

const errorPageMarkup = () => document.getElementById('error-marker')

describe('the client entry on React 16', () => {
  let consoleError

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('adopts the server-rendered markup instead of replacing it', async () => {
    const { serverRenderedNode } = await bootClient({
      containerHTML: PAGE_MARKUP
    })

    // A fresh render would have discarded this node and built a new one.
    expect(document.getElementById('marker')).toBe(serverRenderedNode)
    expect(serverRenderedNode.textContent).toBe('marker:1')
    expect(errorPageMarkup()).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('re-renders the page when the router changes route', async () => {
    const { Router, nextRender } = await bootClient({
      containerHTML: PAGE_MARKUP
    })

    const rendered = nextRender()
    Router.push({ pathname: '/', query: { n: '2' } }, '/?n=2', { shallow: true })
    await rendered

    expect(document.getElementById('marker').textContent).toBe('marker:2')
    expect(errorPageMarkup()).toBeNull()
  })

  it('renders the page into an empty container', async () => {
    // Hydrating an empty container would also build the tree, but warns.
    await bootClient({ containerHTML: '' })

    const rendered = document.getElementById('marker')
    expect(rendered).not.toBeNull()
    expect(rendered.textContent).toBe('marker:1')
    expect(errorPageMarkup()).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
