// The Node build of `@healthline/next/router`, for server rendering, Jest and
// anything else outside a browser. It exports the browser router's names, so
// code that runs on both sides imports one interface. There is no navigation
// here: nothing emits route changes, and navigation calls throw.

const browserOnly = (name) => () => {
  throw new Error(`@healthline/next/router: ${name} works only in the browser`)
}

// One server renders every request, so a listener added during a render would
// outlive it. This emitter keeps no listeners and calls none.
export const events = {
  on () {},
  off () {},
  emit () {}
}

export const createRouter = browserOnly('createRouter')

export default {
  push: browserOnly('Router.push'),
  replace: browserOnly('Router.replace')
}
