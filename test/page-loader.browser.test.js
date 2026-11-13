// VITE-MIGRATION(webpack-deletion): delete this file with the HMR wait in
// lib/page-loader.js.
//
// Jest supplies CommonJS `module`, so run the compiled loader without that
// binding to exercise an ES module bundle's scope.

const path = require('path')

const PAGE = { name: 'the registered page' }

const loadInEsmBundleScope = () => {
  const babel = require('@babel/core')
  const { code } = babel.transformFileSync(
    path.join(__dirname, '..', 'lib', 'page-loader.js'),
    {
      presets: [require.resolve('../babel.js')],
      babelrc: false,
      configFile: false
    }
  )

  const exported = {}
  // eslint-disable-next-line no-new-func
  const run = new Function('exports', 'require', code)
  run(exported, require)
  return exported
}

describe('registerPage in a bundle with no CommonJS module binding', () => {
  it('registers the page instead of throwing on the HMR record', async () => {
    // A global `module` would resolve the identifier and leave the guard
    // untested.
    expect(typeof global.module).toBe('undefined')

    const { registerPage, waitForPage } = loadInEsmBundleScope()
    let didRegister = false

    registerPage('/', () => {
      didRegister = true
      return { page: PAGE }
    })

    expect(didRegister).toBe(true)
    await expect(waitForPage('/')).resolves.toBe(PAGE)
  })
})
