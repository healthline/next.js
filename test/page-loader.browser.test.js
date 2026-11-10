// registerPage reads webpack's HMR record before it registers a page. Under
// Jest and inside a webpack bundle, `module` is the CommonJS wrapper binding,
// so an unguarded `module.hot` read passes there. An ESM bundle such as Vite's
// has no `module` binding, and the same read throws a ReferenceError.
//
// So this suite compiles lib/page-loader.js with the repository's preset, which
// emits CommonJS under Jest, and runs it through `new Function` with only
// `exports` and `require` in scope, where `module` resolves nowhere.

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

    registerPage('/', () => ({ page: PAGE }))

    await expect(waitForPage('/')).resolves.toBe(PAGE)
  })
})
