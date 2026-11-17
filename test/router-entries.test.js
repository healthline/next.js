/* eslint-env jest */
// `@healthline/next/router` resolves to client/router.js in browser bundles and
// to server/router.js everywhere else. Code that runs on both sides imports one
// name, so the condition may choose the implementation but never the interface.
const browserRouter = require('../client/router')
const serverRouter = require('../server/router')

describe('@healthline/next/router', () => {
  it('exports the same names from its browser and server builds', () => {
    expect(Object.keys(serverRouter).sort()).toEqual(Object.keys(browserRouter).sort())
    expect(Object.keys(serverRouter.events).sort()).toEqual(Object.keys(browserRouter.events).sort())
  })

  it('gives the server an emitter that calls no listeners', () => {
    const listener = jest.fn()
    serverRouter.events.on('routeChangeComplete', listener)
    serverRouter.events.emit('routeChangeComplete', '/article')
    serverRouter.events.off('routeChangeComplete', listener)

    expect(listener).not.toHaveBeenCalled()
  })

  it('reports no current route on the server', () => {
    expect(serverRouter.default.route).toBeUndefined()
  })

  it.each(['push', 'replace'])('rejects %s on the server, where there is no navigation', method => {
    expect(() => serverRouter.default[method]('/article')).toThrow(/only in the browser/)
  })

  it('rejects createRouter on the server', () => {
    expect(() => serverRouter.createRouter('/article', {}, '/article', {}, () => {})).toThrow(/only in the browser/)
  })
})
