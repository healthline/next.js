import Router, { createRouter } from 'next/router'

describe('the browser test environment', () => {
  it('provides a DOM document that next/head can write into', () => {
    document.title = 'set by the browser test environment'

    expect(document.title).toBe('set by the browser test environment')
    expect(document.querySelectorAll('head')).toHaveLength(1)
  })

  it('resolves next/router to the client router rather than the server one', () => {
    // The server variant's default export is a RouterState class and has no
    // createRouter; only the client variant exposes one.
    expect(typeof createRouter).toBe('function')
    expect(typeof Router.push).toBe('function')
  })
})
