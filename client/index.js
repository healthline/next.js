// Fucking IE11
import 'core-js/es6/promise'

import { createElement } from 'react'
import ReactDOM from 'react-dom'
import { createRouter } from '../lib/router'
import EventEmitter from '../lib/EventEmitter'
import App from '../lib/app'
import { getURL } from '../lib/utils'
import { loadPage } from '../lib/page-loader'

const {
  __NEXT_DATA__: {
    props,
    err,
    pathname,
    query,
    publicPath
  },
  location
} = window

__webpack_public_path__ = publicPath    // eslint-disable-line

const asPath = getURL()

const headManager = new HeadManager()
const appContainer = document.getElementById('__next')
const errorContainer = document.getElementById('__next-error')

let lastAppProps
export let router
export let ErrorComponent
let Component

export const emitter = new EventEmitter()

export default async () => {
  ErrorComponent = await loadPage('/_error')

  try {
    Component = await loadPage(pathname)
  } catch (err) {
    console.error(err)
    Component = ErrorComponent
  }

  router = createRouter(pathname, query, asPath, {
    Component,
    ErrorComponent,
    err
  })

  router.subscribe(({ Component, props, hash, err }) => {
    render({ Component, props, err, hash, emitter })
  })

  const hash = location.hash.substring(1)
  render({ Component, props, hash, err, emitter })

  return emitter
}

export async function render ({ Component, props, hash, err, emitter: emitterProp = emitter }) {
  // There are some errors we should ignore.
  // Next.js rendering logic knows how to handle them.
  // These are specially 404 errors
  if (err && !err.ignore) {
    await renderError(err)
    return
  }

  try {
    if (!props && Component &&
    Component !== ErrorComponent &&
    lastAppProps.Component === ErrorComponent) {
    // fetch props if ErrorComponent was replaced with a page component by HMR
      const { pathname, query, asPath } = router
      props = await Component.getInitialProps({ err, pathname, query, asPath })
    }

    Component = Component || lastAppProps.Component
    props = props || lastAppProps.props

    const appProps = { Component, props, hash, err, router }
    // lastAppProps has to be set before ReactDom.render to account for ReactDom throwing an error.
    lastAppProps = appProps

    emitterProp.emit('before-reactdom-render', { Component, ErrorComponent, appProps })

    // We need to clear any existing runtime error messages
    ReactDOM.unmountComponentAtNode(errorContainer)
    errorContainer.innerHTML = ''

    renderReactElement(createElement(App, appProps), appContainer)

    emitterProp.emit('after-reactdom-render', { Component, ErrorComponent, appProps })
  } catch (err) {
    if (err.abort) return
    await renderError(err)
  }
}

// This method handles all runtime and debug errors.
// 404 and 500 errors are special kind of errors
// and they are still handle via the main render method.
export async function renderError (error) {
  // We need to unmount the current app component because it's
  // in the inconsistant state.
  // Otherwise, we need to face issues when the issue is fixed and
  // it's get notified via HMR
  ReactDOM.unmountComponentAtNode(appContainer)

  console.error(error)

  const props = await ErrorComponent.getInitialProps({ err: error, pathname, query, asPath })
  const appProps = { Component: ErrorComponent, props, err, router }
  renderReactElement(createElement(App, appProps), errorContainer)

  appContainer.innerHTML = ''
}

let isInitialRender = true
function renderReactElement (reactEl, domEl) {
  if (isInitialRender && domEl.firstChild) {
    ReactDOM.hydrate(reactEl, domEl)
    isInitialRender = false
  } else {
    ReactDOM.render(reactEl, domEl)
    isInitialRender = false
  }
}
