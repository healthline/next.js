/* global window, document */
import mitt from 'mitt'

const pageCache = {}
const pageRegisterEvents = mitt()

export function waitForPage (route) {
  route = normalizeRoute(route)

  return new Promise((resolve, reject) => {
    const fire = ({ error, page }) => {
      pageRegisterEvents.off(route, fire)

      if (error) {
        reject(error)
      } else {
        resolve(page)
      }
    }

    // If there's a cached version of the page, let's use it.
    const cachedPage = pageCache[route]
    if (cachedPage) {
      const { error, page } = cachedPage
      error ? reject(error) : resolve(page)
      return
    }

    // Register a listener to get the page
    pageRegisterEvents.on(route, fire)
  })
}

// This method if called by the route code.
export function registerPage (route, regFn) {
  const register = () => {
    try {
      const { error, page } = regFn()
      pageCache[route] = { error, page }
      pageRegisterEvents.emit(route, { error, page })
    } catch (error) {
      pageCache[route] = { error }
      pageRegisterEvents.emit(route, { error })
    }
  }

  // Wait for webpack to become idle if it's not.
  // More info: https://github.com/zeit/next.js/pull/1511
  //
  // `module` is the CommonJS binding webpack wraps every module in, and
  // `module.hot` is its HMR record. A bundle with no CommonJS wrapper -- an
  // ESM bundle such as Vite's -- has no `module` binding at all, so naming it
  // is a ReferenceError rather than an undefined property lookup. The typeof
  // guard skips the HMR wait there instead, the same shape as the
  // `__webpack_public_path__` guard in client/index.js.
  const hot = typeof module !== 'undefined' && module.hot ? module.hot : null

  if (hot && hot.status() !== 'idle') {
    console.log(`Waiting for webpack to become "idle" to initialize the page: "${route}"`)

    const check = (status) => {
      if (status === 'idle') {
        hot.removeStatusHandler(check)
        register()
      }
    }
    hot.status(check)
  } else {
    register()
  }
}

function normalizeRoute (route) {
  if (process.env.NODE_ENV !== 'production' && route[0] !== '/') {
    throw new Error(`Route name should start with a "/", got "${route}"`)
  }
  route = route.replace(/\/index$/, '/')

  if (route === '/') return route
  return route.replace(/\/$/, '')
}
