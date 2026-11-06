import { doPageRender } from '../server/render'

describe('the server render module', () => {
  it('is loadable by the test runner and exposes its page render entry point', () => {
    expect(typeof doPageRender).toBe('function')
  })
})
