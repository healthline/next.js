// registerPage reaches for webpack's HMR record before it registers a page.
// Under Jest -- and inside any webpack bundle -- `module` is the CommonJS
// wrapper binding, so a bare `module.hot` is a harmless undefined lookup and
// an ordinary `require('../lib/page-loader')` cannot tell a guarded read from
// an unguarded one. An ESM bundle such as Vite's has no `module` binding at
// all, where the same read is a ReferenceError.
//
// So this suite loads the module the way such a bundle would: it compiles
// lib/page-loader.js with the repository's own preset plus the CommonJS
// transform that babel-jest adds (the preset itself leaves ESM in place), then
// runs the result through `new Function` with only `exports` and `require` in
// scope. `module` is then a free identifier that resolves nowhere, which is
// exactly the condition the guard exists for. Removing the guard makes this
// suite throw a ReferenceError instead of registering the page.
//
// The CommonJS transform is resolved rather than declared: it arrives with
// preset-env, which the preset this repository publishes already requires.

const path = require('path')

const PAGE = { name: 'the registered page' }

const loadInEsmBundleScope = () => {
  const babel = require('@babel/core')
  const { code } = babel.transformFileSync(
    path.join(__dirname, '..', 'lib', 'page-loader.js'),
    {
      presets: [require.resolve('../babel.js')],
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
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
  it('has no global module to fall back on', () => {
    // The precondition the rest of this suite means nothing without: if some
    // other module or setup file defined a global `module`, the compiled code
    // below would resolve the identifier and the guard would go untested.
    expect(typeof global.module).toBe('undefined')
  })

  it('registers the page instead of throwing on the HMR record', async () => {
    const { registerPage, waitForPage } = loadInEsmBundleScope()

    registerPage('/', () => ({ page: PAGE }))

    await expect(waitForPage('/')).resolves.toBe(PAGE)
  })
})
