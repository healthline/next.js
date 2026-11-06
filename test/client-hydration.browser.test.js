/* global document */

// The client entry reads __NEXT_DATA__ and the #__next container while its
// module body runs, so both are arranged before the entry is required. No
// webpack global is arranged: the entry assigns one only where webpack has
// defined it, which is what lets a non-webpack bundle load it at all.
// `next/client` is unreachable through its alias under Jest, so the entry is
// required relatively.
//
// Every test boots its own copy of the entry through `bootClient`. The entry
// keeps module state (the container it captured, and whether the next render is
// the first one), so a shared boot in beforeAll would make one test's render
// the precondition of the next and the order would matter. jest.resetModules
// gives each test its own entry, router, and page registry.
//
// The page and the error page render *different* markup. With one component on
// both routes, a run where the page failed to load and the error page rendered
// in its place would produce the same DOM and every assertion here would still
// pass, so each assertion also states that the error markup is absent.
//
// A hydration mismatch is caught by the project's setup file, not here: React
// 16 keeps the server's nodes and only warns, so identity assertions alone do
// not prove the markup agreed. The jest.resetModules above is what keeps that
// guard working test after test: React warns once per react-dom module
// registry and never resets the flag, so each hydration needs a fresh registry.
// See test/setup/fail-on-hydration-warning.js.

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

  // Distinct markup, so an error-page fallback is visible in the DOM.
  const ErrorPage = () =>
    createElement('span', { id: 'error-marker' }, 'error page')
  ErrorPage.getInitialProps = () => ({})

  registerPage('/', () => ({ page: Page }))
  registerPage('/_error', () => ({ page: ErrorPage }))

  await client.default()

  const nextRender = () =>
    new Promise((resolve) => {
      const done = () => {
        client.emitter.off('after-reactdom-render', done)
        resolve()
      }
      client.emitter.on('after-reactdom-render', done)
    })

  return { Router, nextRender, serverRenderedNode }
}

const errorPageMarkup = () => document.getElementById('error-marker')

describe('the client entry on React 16', () => {
  it('adopts the server-rendered markup instead of replacing it', async () => {
    const { serverRenderedNode } = await bootClient({
      containerHTML: PAGE_MARKUP
    })

    // Hydration reuses the nodes the server sent; a fresh render would have
    // discarded this node and built a new one.
    expect(document.getElementById('marker')).toBe(serverRenderedNode)
    expect(serverRenderedNode.textContent).toBe('marker:1')
    expect(errorPageMarkup()).toBeNull()
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
    // No server markup to adopt: the entry's first render takes the ordinary
    // render arm. Hydrating an empty container instead would leave a tree in
    // place but warn, which the project's setup file fails on.
    await bootClient({ containerHTML: '' })

    const rendered = document.getElementById('marker')
    expect(rendered).not.toBeNull()
    expect(rendered.textContent).toBe('marker:1')
    expect(errorPageMarkup()).toBeNull()
  })
})
