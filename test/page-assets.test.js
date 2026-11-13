import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { JSDOM } from 'jsdom'
import Document, { Head, Main, NextScript } from '../server/document'
import createServer, { doPageRender, doDocRender } from '../server/next'
import { HotReloader } from '@healthline/six-million'

jest.mock('@healthline/six-million', () => ({ HotReloader: jest.fn() }))

// The server renders a page's tags from the assets its consumer passes to
// next({ assets }). The URLs differ from PUBLIC_PATH, so a server that
// prefixed them would fail every tag test.

const PUBLIC_PATH = 'https://cdn.example.test/prefix/_next/'

const ARTICLE = {
  entry: 'https://static.example.test/b7/article-AAAA.js',
  stylesheets: ['/b7/base-BBBB.css', 'https://static.example.test/b7/article-CCCC.css?v=1&x=2'],
  preloads: ['/b7/shared-DDDD.js', 'http://static.example.test/b7/ui-EEEE.js']
}

// Distinct from ARTICLE's, so a test can tell which page's tags rendered.
const ERROR_PAGE = {
  entry: '/b7/error-HHHH.js',
  stylesheets: ['/b7/error-IIII.css'],
  preloads: ['/b7/error-shared-JJJJ.js']
}

const ASSETS = {
  buildId: 'build-7',
  pages: {
    '/article': ARTICLE,
    '/_error': ERROR_PAGE,
    '/': { entry: '/b7/index-FFFF.js', stylesheets: [], preloads: [] },
    '/hl/week': { entry: '/b7/week-GGGG.js', stylesheets: [], preloads: [] }
  }
}

const PAGES_WITHOUT_ERROR_PAGE = Object.fromEntries(
  Object.entries(ASSETS.pages).filter(([route]) => route !== '/_error')
)

// webpack's entrypoints name /article too, so a test can tell which one won.
const ENTRYPOINTS = {
  'pages/standard.js': {
    chunks: [
      { file: 'build-1/hl/vendor.js', module: true },
      { file: 'build-1/hl/pages/standard.js', module: true }
    ]
  },
  'pages/article.js': {
    chunks: [{ file: 'build-1/hl/pages/article.js', module: true }]
  }
}

const parse = (markup) => new JSDOM(markup).window.document

// The URLs of a document's loading tags, by kind, in document order, and the
// `src` of every script (null for an inline script). Parsed as HTML, so
// attribute order and quoting do not matter.
const loadingTags = (markup) => {
  const document = parse(markup)
  const urls = (selector, attribute) =>
    [...document.querySelectorAll(selector)].map((element) => element.getAttribute(attribute))

  return {
    moduleScripts: urls('script[type="module"][src]', 'src'),
    modulepreloads: urls('link[rel="modulepreload"]', 'href'),
    stylesheets: urls('link[rel="stylesheet"]', 'href'),
    preloads: urls('link[rel="preload"]', 'href'),
    scriptSources: urls('script', 'src')
  }
}

const inlineScript = (markup) => parse(markup).querySelector('script:not([src])').textContent

const nextData = (markup) => JSON.parse(inlineScript(markup).replace(/^module=\{\};__NEXT_DATA__=/, ''))

class NonceDocument extends Document {
  render () {
    return createElement('html', null,
      createElement(Head),
      createElement('body', null, createElement(Main), createElement(NextScript, { nonce: 'n0nce' }))
    )
  }
}

const renderDocument = ({ pathname, assets, entrypoints = ENTRYPOINTS, DocumentClass = Document }) =>
  renderToStaticMarkup(
    createElement(DocumentClass, {
      __NEXT_DATA__: {
        buildId: 'build-7',
        props: {},
        pathname,
        query: {},
        publicPath: PUBLIC_PATH,
        err: null
      },
      entrypoints,
      assets,
      html: '<div>page</div>',
      head: `<title>${pathname.slice(1)}</title>`,
      errorHtml: '',
      styles: null,
      dev: false
    })
  )

const scratchDirs = []

afterAll(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

const documentModule = JSON.stringify(require.resolve('../server/document'))

const PASS_THROUGH_DOCUMENT = `
  const Document = require(${documentModule}).default
  class PassThrough extends Document {}
  PassThrough.getInitialProps = async ({ renderPage }) => renderPage()
  module.exports = PassThrough
`

const OVERRIDING_DOCUMENT = `
  const Document = require(${documentModule}).default
  class Overriding extends Document {}
  Overriding.getInitialProps = async ({ renderPage }) => ({
    ...renderPage(),
    pathname: '/_error',
    props: { title: 'Document props' },
    query: { section: 'Document query' },
    err: { message: 'Document error' },
    assets: {
      buildId: 'other',
      pages: { '/article': { entry: '/elsewhere.js', stylesheets: ['/elsewhere.css'], preloads: [] } }
    },
    entrypoints: ${JSON.stringify(ENTRYPOINTS)}
  })
  module.exports = Overriding
`

// An app directory holding only the server tree the server requires pages
// from. `files` adds more, relative to the directory.
const appDir = ({ document = PASS_THROUGH_DOCUMENT, files = {} } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'next-page-assets-'))
  scratchDirs.push(dir)
  const pageDir = join(dir, '.next', 'server', 'pages')
  mkdirSync(pageDir, { recursive: true })
  writeFileSync(join(pageDir, '_document.js'), document)
  mkdirSync(join(pageDir, 'hl', 'week'), { recursive: true })
  for (const page of ['article', 'standard', 'missing', '_error', 'index', 'hl/week/index']) {
    writeFileSync(join(pageDir, `${page}.js`), `module.exports = () => '${page} body'`)
  }
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
  return dir
}

// A request for `pathname`, rendered the way a consumer renders one: the page,
// then the document, through the instance methods.
const renderThroughServer = async (app, pathname, { page, err, amp } = {}) => {
  const rendered = await app.renderPage({ url: pathname }, {}, pathname, {}, {}, { page, err })
  return app.renderDocument(rendered, {}, { amp })
}

let siteBefore

beforeEach(() => {
  siteBefore = process.env.SITE
  delete process.env.SITE
  // A server that would exit the process fails the test instead.
  jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  if (siteBefore === undefined) {
    delete process.env.SITE
  } else {
    process.env.SITE = siteBefore
  }
})

describe('a server given assets, outside dev', () => {
  it('starts and renders a page with no build ID file, no webpack entrypoints file and no SITE', async () => {
    const dir = appDir()
    expect(existsSync(join(dir, '.next', 'BUILD_ID'))).toBe(false)
    expect(existsSync(join(dir, '.next', 'webpack-entrypoints.json'))).toBe(false)
    expect(process.env.SITE).toBeUndefined()

    const app = createServer({ dir, dev: false, assets: ASSETS })
    const markup = await renderThroughServer(app, '/article')

    expect(loadingTags(markup).moduleScripts).toEqual([ARTICLE.entry])
    expect(nextData(markup).buildId).toBe('build-7')
  })

  it('ignores a build ID file, a webpack entrypoints file and SITE when they are there', async () => {
    // Each would stop or change the start if read: an unparseable file, and a
    // SITE it does not name.
    process.env.SITE = 'no-such-site'
    const dir = appDir({
      files: { '.next/BUILD_ID': 'stale-build\n', '.next/webpack-entrypoints.json': '{' }
    })

    const app = createServer({ dir, dev: false, assets: ASSETS })
    const markup = await renderThroughServer(app, '/article')

    expect(app.renderOpts.buildId).toBe('build-7')
    expect(loadingTags(markup).moduleScripts).toEqual([ARTICLE.entry])
  })
})

describe('the route key', () => {
  // The key is the pathname doPageRender returns: the path it is given, with
  // its first `/index` removed.
  const entryFor = async (pathname) =>
    loadingTags(await renderThroughServer(createServer({ dir: appDir(), dev: false, assets: ASSETS }), pathname)).moduleScripts

  it('is "/" for the index page rendered as "/"', async () => {
    expect(await entryFor('/')).toEqual(['/b7/index-FFFF.js'])
  })

  it('drops a nested page\'s trailing /index', async () => {
    expect(await entryFor('/hl/week/index')).toEqual(['/b7/week-GGGG.js'])
  })

  it('is "/index", which "/" does not match, for the index page rendered as "/index"', async () => {
    await expect(entryFor('/index')).rejects.toThrow('No scripts found for /index')
  })
})

describe('the assets option, checked when the server is constructed', () => {
  const start = (assets) => () => createServer({ dir: appDir(), dev: false, assets })
  const withArticle = (changes) =>
    ({ ...ASSETS, pages: { ...ASSETS.pages, '/article': { ...ARTICLE, ...changes } } })
  const articleWithoutEntry = { stylesheets: ARTICLE.stylesheets, preloads: ARTICLE.preloads }

  it('accepts every URL form: a path, http:// and https://', () => {
    expect(start(ASSETS)).not.toThrow()
  })

  it.each([
    ['a missing buildId', { pages: ASSETS.pages }, 'assets.buildId'],
    ['an empty buildId', { ...ASSETS, buildId: '' }, 'assets.buildId'],
    ['missing pages', { buildId: 'build-7' }, 'assets.pages'],
    ['pages that are a Map', { ...ASSETS, pages: new Map(Object.entries(ASSETS.pages)) }, 'assets.pages must be an object'],
    ['pages that are an array', { ...ASSETS, pages: [ARTICLE] }, 'assets.pages must be an object'],
    ['a route without a leading slash', { ...ASSETS, pages: { ...ASSETS.pages, article: ARTICLE } }, 'assets.pages["article"]'],
    ['a route with two leading slashes', { ...ASSETS, pages: { ...ASSETS.pages, '//article': ARTICLE } }, 'assets.pages["//article"]: a route starts with a single "/"'],
    ['a route starting with /\\', { ...ASSETS, pages: { ...ASSETS.pages, '/\\article': ARTICLE } }, 'assets.pages["/\\\\article"]: a route starts with a single "/"'],
    ['no entry for the error page', { ...ASSETS, pages: PAGES_WITHOUT_ERROR_PAGE }, 'assets.pages["/_error"] is missing'],
    ['a page that is not an object', { ...ASSETS, pages: { '/article': '/b7/article.js' } }, 'assets.pages["/article"] must be an object'],
    ['a missing entry', { ...ASSETS, pages: { '/article': articleWithoutEntry } }, 'assets.pages["/article"].entry'],
    ['an entry that is a relative file path', withArticle({ entry: 'b7/article-AAAA.js' }), 'assets.pages["/article"].entry'],
    ['an entry with another scheme', withArticle({ entry: 'ftp://static.example.test/a.js' }), 'assets.pages["/article"].entry'],
    ['an entry with a scheme but no //', withArticle({ entry: 'https:static.example.test/a.js' }), 'assets.pages["/article"].entry'],
    ['an empty entry', withArticle({ entry: '' }), 'assets.pages["/article"].entry'],
    ['an entry starting with //', withArticle({ entry: '//cdn.example.com/a.js' }), 'assets.pages["/article"].entry'],
    ['an entry starting with /\\', withArticle({ entry: '/\\cdn.example.com/a.js' }), 'assets.pages["/article"].entry'],
    ['stylesheets that are a string, not a list', withArticle({ stylesheets: '/b7/base.css' }), 'assets.pages["/article"].stylesheets'],
    ['a stylesheet that is a relative file path', withArticle({ stylesheets: ['/b7/base.css', 'article.css'] }), 'assets.pages["/article"].stylesheets[1]'],
    ['a stylesheet starting with //', withArticle({ stylesheets: ['/b7/base.css', '//cdn.example.com/a.css'] }), 'assets.pages["/article"].stylesheets[1]'],
    ['missing preloads', withArticle({ preloads: undefined }), 'assets.pages["/article"].preloads'],
    ['a preload that is not a string', withArticle({ preloads: [7] }), 'assets.pages["/article"].preloads[0]'],
    ['a preload starting with //', withArticle({ preloads: ['//cdn.example.com/a.js'] }), 'assets.pages["/article"].preloads[0]']
  ])('refuses to start with %s, naming the field', (_, assets, field) => {
    expect(start(assets)).toThrow(field)
  })

  it.each([
    ['null', null],
    ['a function', () => ASSETS]
  ])('refuses %s in place of the value', (_, assets) => {
    expect(start(assets)).toThrow('The assets option must be an object')
  })

  it('reports every invalid field in one error', () => {
    const assets = { buildId: '', pages: { '/article': { ...ARTICLE, entry: 'a.js', preloads: ['b.js'] } } }
    let error

    try {
      start(assets)()
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    for (const field of [
      'assets.buildId',
      'assets.pages["/article"].entry',
      'assets.pages["/article"].preloads[0]',
      'assets.pages["/_error"]'
    ]) {
      expect(error.message).toContain(field)
    }
  })

  it('renders from the value it checked, not from later changes to it', async () => {
    const assets = JSON.parse(JSON.stringify(ASSETS))
    const app = createServer({ dir: appDir(), dev: false, assets })
    assets.pages['/article'].entry = 'not checked'
    assets.pages['/article'].stylesheets.push('not checked')
    assets.pages['/article'].preloads.push('not checked')

    const tags = loadingTags(await renderThroughServer(app, '/article'))

    expect(tags.moduleScripts).toEqual([ARTICLE.entry])
    expect(tags.stylesheets).toEqual(ARTICLE.stylesheets)
    expect(tags.modulepreloads).toEqual(ARTICLE.preloads)
  })
})

describe('the tags of a page the assets name', () => {
  let markup
  let tags

  beforeAll(() => {
    markup = renderDocument({ pathname: '/article', assets: ASSETS, DocumentClass: NonceDocument })
    tags = loadingTags(markup)
  })

  it('loads the entry as the only script with a src, after the inline __NEXT_DATA__ script', () => {
    // The client entry reads __NEXT_DATA__ as soon as it runs.
    expect(tags.scriptSources).toEqual([null, ARTICLE.entry])
    expect(tags.moduleScripts).toEqual([ARTICLE.entry])
  })

  it('links the stylesheets in the order given', () => {
    expect(tags.stylesheets).toEqual(ARTICLE.stylesheets)
  })

  it('preloads the given modules', () => {
    // Sorted, because preload order changes nothing a browser does.
    expect([...tags.modulepreloads].sort()).toEqual([...ARTICLE.preloads].sort())
  })

  it('puts the stylesheet and modulepreload links in <head>', () => {
    const document = parse(markup)

    expect([...document.querySelectorAll('link')].every((link) => link.parentElement === document.head)).toBe(true)
    expect(document.head.querySelectorAll('link').length).toBe(ARTICLE.stylesheets.length + ARTICLE.preloads.length)
  })

  it('gets no webpack tags, although the webpack entrypoints name the route', () => {
    expect(tags.preloads).toEqual([])
  })

  it('marks every loading tag crossorigin, the inline script alone with the nonce, and the entry not async', () => {
    const document = parse(markup)
    const loading = [...document.querySelectorAll('script[src], link[rel="stylesheet"], link[rel="modulepreload"]')]
    const entryScript = document.querySelector('script[type="module"][src]')

    expect(loading.map((element) => element.getAttribute('crossorigin'))).toEqual(loading.map(() => 'anonymous'))
    expect([...document.querySelectorAll('script')].map((script) => script.getAttribute('nonce'))).toEqual(['n0nce', null])
    expect(entryScript.hasAttribute('async')).toBe(false)
  })

  it('keeps the module={} shim in front of __NEXT_DATA__', () => {
    expect(inlineScript(markup)).toMatch(/^module=\{\};__NEXT_DATA__=\{/)
    expect(nextData(markup).pathname).toBe('/article')
  })

  it('keeps a link URL whole when it holds a quote', () => {
    const url = '/b7/odd?q="><script>x</script>'
    const assets = { ...ASSETS, pages: { '/article': { ...ARTICLE, stylesheets: [`${url}.css`], preloads: [`${url}.js`] } } }
    const tags = loadingTags(renderDocument({ pathname: '/article', assets }))

    expect(tags.stylesheets).toEqual([`${url}.css`])
    expect(tags.modulepreloads).toEqual([`${url}.js`])
  })
})

describe('a route the assets do not name', () => {
  // VITE-MIGRATION(webpack-deletion): delete this test once no site builds
  // pages with webpack.
  it("renders from webpack's entrypoints and public path when the render options carry them", async () => {
    const dir = appDir({ files: {
      'next.config.js': 'throw new Error("Build configuration must not run")'
    } })
    const app = createServer({ dir, assets: ASSETS })
    const options = { ...app.renderOpts, entrypoints: ENTRYPOINTS, publicPath: PUBLIC_PATH }
    const page = await doPageRender({ url: '/standard' }, {}, '/standard', {}, {}, options)
    const markup = await doDocRender(page, {}, options)

    expect(loadingTags(markup).moduleScripts).toEqual(
      ENTRYPOINTS['pages/standard.js'].chunks.map(({ file }) => `${PUBLIC_PATH}${file}`)
    )
  })

  it('fails the render when there are no entrypoints either', async () => {
    const app = createServer({ dir: appDir(), dev: false, assets: ASSETS })

    await expect(renderThroughServer(app, '/missing')).rejects.toThrow('No scripts found for /missing')
  })

  it('renders the same markup as when there are no assets', () => {
    expect(renderDocument({ pathname: '/standard', assets: ASSETS }))
      .toBe(renderDocument({ pathname: '/standard', assets: undefined }))
  })
})

describe('instance rendering', () => {
  it('returns page data without rendering the component when the overload check refuses work', async () => {
    const app = createServer({
      assets: ASSETS,
      loadPage: () => () => { throw new Error('Overloaded server must not render') }
    })
    const page = await app.renderPage({ url: '/article' }, {}, '/article', { section: 'food' }, { title: 'Article' }, {
      overloadCheck: () => true
    })
    expect(page).toMatchObject({ pathname: '/article', query: { section: 'food' }, props: { title: 'Article' } })
    expect(page.html).toBeUndefined()
  })

  it("keeps each server's page loader and build identity together across renders", async () => {
    const first = createServer({
      assets: ASSETS,
      loadPage: id => id === '/_document' ? Document : () => 'first article'
    })
    const second = createServer({
      assets: { ...ASSETS, buildId: 'build-8', pages: { ...ASSETS.pages, '/article': { ...ARTICLE, entry: '/b8/article.js' } } },
      loadPage: id => id === '/_document' ? Document : () => 'second article'
    })

    for (const [app, body, buildId, entry] of [
      [first, 'first article', 'build-7', ARTICLE.entry],
      [second, 'second article', 'build-8', '/b8/article.js'],
      [first, 'first article', 'build-7', ARTICLE.entry]
    ]) {
      const markup = await renderThroughServer(app, '/article')
      expect(markup).toContain(body)
      expect(nextData(markup).buildId).toBe(buildId)
      expect(loadingTags(markup).moduleScripts).toEqual([entry])
    }
  })
})

describe('the assets, against what a Document passes', () => {
  it('uses the processed page data with the package Document', async () => {
    const app = createServer({
      assets: ASSETS,
      loadPage: async (route) => route === '/_document' ? Document : () => 'article body'
    })

    const page = await app.renderPage({ url: '/article?section=food' }, {}, '/article', { section: 'food' }, { title: 'Article' }, {
      enhancer: Component => props => createElement('main', null, createElement(Component, props))
    })
    page.props = { ...page.props, title: 'Processed article' }
    const markup = await app.renderDocument(page, {})
    const tags = loadingTags(markup)
    const data = nextData(markup)

    const wrapper = parse(markup).querySelector('#__next > main')
    expect(wrapper && wrapper.textContent).toBe('article body')
    expect(data.props).toEqual({ title: 'Processed article' })
    expect(data.query).toEqual({ section: 'food' })
    expect(data.err).toBeUndefined()
    expect(tags.moduleScripts).toEqual([ARTICLE.entry])
    expect(tags.stylesheets).toEqual(ARTICLE.stylesheets)
    expect(tags.modulepreloads).toEqual(ARTICLE.preloads)
  })

  it("wins over the route, assets and entrypoints a Document's getInitialProps returns", async () => {
    const app = createServer({ dir: appDir({ document: OVERRIDING_DOCUMENT }), dev: false, assets: ASSETS })

    const tags = loadingTags(await renderThroughServer(app, '/article'))

    expect(tags.moduleScripts).toEqual([ARTICLE.entry])
    expect(tags.stylesheets).toEqual(ARTICLE.stylesheets)
  })
})

describe('browser data on the supplied-assets path', () => {
  it.each([
    ['an error', { message: 'Page error', technicalErrorDetails: { errorStack: 'Frontend diagnostics' } }],
    ['no error', undefined]
  ])('preserves the page props, query and %s over conflicting Document values', async (_, err) => {
    const app = createServer({ dir: appDir({ document: OVERRIDING_DOCUMENT }), assets: ASSETS })
    const page = {
      pathname: '/article',
      props: { title: 'Processed article' },
      query: { section: 'food' },
      err,
      html: '<article>Processed article</article>',
      head: ''
    }

    const markup = await app.renderDocument(page, {})
    const data = nextData(markup)

    expect(data.props).toEqual({ title: 'Processed article' })
    expect(data.query).toEqual({ section: 'food' })
    expect(data.err).toEqual(err)
  })
})

describe('the error page', () => {
  const error = Object.assign(new Error('boom'), { status: 500 })

  it('rendered for a request to a route the assets name, loads that route\'s assets', async () => {
    const app = createServer({ dir: appDir(), dev: false, assets: ASSETS })

    const markup = await renderThroughServer(app, '/article', { page: '_error', err: error })

    expect(loadingTags(markup).moduleScripts).toEqual([ARTICLE.entry])
    expect(parse(markup).getElementById('__next').textContent).toBe('_error body')
  })

  it('rendered as /_error, loads the /_error entry\'s script, stylesheets and preloads', async () => {
    const app = createServer({ dir: appDir(), dev: false, assets: ASSETS })

    const tags = loadingTags(await renderThroughServer(app, '/_error', { page: '_error', err: error }))

    expect(tags.moduleScripts).toEqual([ERROR_PAGE.entry])
    expect(tags.stylesheets).toEqual(ERROR_PAGE.stylesheets)
    expect(tags.modulepreloads).toEqual(ERROR_PAGE.preloads)
  })

  it('rendered as /_error with assets that do not name it, fails rather than rendering no script', () => {
    // Startup refuses such assets; this is the document's own check.
    const assets = { ...ASSETS, pages: PAGES_WITHOUT_ERROR_PAGE }

    expect(() => renderDocument({ pathname: '/_error', assets, entrypoints: {} }))
      .toThrow('No scripts found for /_error')
  })

  // VITE-MIGRATION(webpack-deletion): delete this test with the exemption.
  it('rendered as /_error without assets, still renders with no page script', () => {
    const markup = renderDocument({ pathname: '/_error', assets: undefined, entrypoints: {} })

    expect(loadingTags(markup).scriptSources).toEqual([null])
  })
})

// VITE-MIGRATION(webpack-deletion): delete this describe once every site
// passes assets.
describe('a server not given assets', () => {
  // Omitting assets must preserve the 28.0 webpack response byte-for-byte.
  // Keep serialization in this assertion, not only equivalent DOM content.
  const STANDARD_MARKUP =
    '<!DOCTYPE html><html><head>\n' +
    '<link rel=preload href="/_next/build-1/hl/vendor.js" as=script crossorigin=anonymous><link rel=preload href="/_next/build-1/hl/pages/standard.js" as=script crossorigin=anonymous>\n' +
    '<meta charSet="utf-8" class="next-head" data-reactroot=""/>\n' +
    '\n' +
    '    </head><body><div id="__next">standard body</div><script>module={};__NEXT_DATA__={"buildId":"build-1","props":{},"pathname":"/standard","query":{},"publicPath":"/_next/"}</script><script type="module" src="/_next/build-1/hl/vendor.js" crossorigin="anonymous" async=""></script><script type="module" src="/_next/build-1/hl/pages/standard.js" crossorigin="anonymous" async=""></script></body></html>'

  it('keeps the configured CDN prefix for legacy rendering', async () => {
    const dir = appDir({ files: {
      'next.config.js': 'module.exports = { assetPrefix: "https://cdn.example.test/prefix/" }',
      '.next/BUILD_ID': 'build-1',
      '.next/webpack-entrypoints.json': JSON.stringify({ default: ENTRYPOINTS })
    } })
    const markup = await renderThroughServer(createServer({ dir }), '/standard')
    expect(nextData(markup).publicPath).toBe(PUBLIC_PATH)
    expect(loadingTags(markup).moduleScripts).toEqual(
      ENTRYPOINTS['pages/standard.js'].chunks.map(({ file }) => `${PUBLIC_PATH}${file}`)
    )
  })

  it('reads the build ID and SITE\'s webpack entrypoints, and preserves the 28.0 webpack markup', async () => {
    process.env.SITE = 'hl'
    const dir = appDir({
      files: {
        '.next/BUILD_ID': 'build-1\n',
        '.next/webpack-entrypoints.json': JSON.stringify({ hl: ENTRYPOINTS, mnt: {} })
      }
    })

    const markup = await renderThroughServer(createServer({ dir, dev: false }), '/standard')

    expect(markup).toBe(STANDARD_MARKUP)
  })
})

describe('a consumer-owned server-page loader', () => {
  class LoadedDocument extends Document {
    static async getInitialProps ({ renderPage }) { return renderPage() }
  }
  class LoadedAmpDocument extends LoadedDocument {
    render () { return createElement('html', { amp: '' }, createElement('body', null, 'loaded AMP document')) }
  }

  it.each([
    ['/article', false, undefined, 'loaded article', ARTICLE.entry],
    ['/_error', true, '_error', 'loaded error', ERROR_PAGE.entry]
  ])('renders %s with dev=%s without reading build configuration or server files', async (pathname, dev, page, body, script) => {
    const dir = mkdtempSync(join(tmpdir(), 'next-loaded-pages-'))
    scratchDirs.push(dir)
    writeFileSync(join(dir, 'next.config.js'), 'throw new Error("Build configuration must not run")')
    const components = {
      '/article': () => 'loaded article',
      '/_error': () => 'loaded error',
      '/_document': LoadedDocument
    }
    const app = createServer({ dir, dev, assets: ASSETS, loadPage: async id => components[id] })
    const markup = await renderThroughServer(app, pathname, { page })
    expect(markup).toContain(body)
    expect(loadingTags(markup).moduleScripts).toEqual([script])
    expect(existsSync(join(dir, '.next'))).toBe(false)
  })

  it('loads the AMP document through the same loader', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'next-loaded-amp-'))
    scratchDirs.push(dir)
    const app = createServer({
      dir,
      assets: ASSETS,
      loadPage: async id => ({ '/article': () => 'article', '/_amp': LoadedAmpDocument })[id]
    })
    expect(await renderThroughServer(app, '/article', { amp: true }))
      .toContain('loaded AMP document')
  })

  it('propagates a loader failure without falling back to disk, and loads again on the next render', async () => {
    const failure = new Error('page compilation failed')
    let fail = true
    let body = 'first loaded version'
    const app = createServer({
      dir: appDir(),
      assets: ASSETS,
      loadPage: async id => {
        if (fail) throw failure
        if (id === '/_document') return LoadedDocument
        const currentBody = body
        return () => currentBody
      }
    })
    await expect(renderThroughServer(app, '/article')).rejects.toBe(failure)
    fail = false
    expect(await renderThroughServer(app, '/article')).toContain('first loaded version')
    body = 'updated loaded version'
    expect(await renderThroughServer(app, '/article')).toContain('updated loaded version')
  })

  it('rejects a non-function loader at startup', () => {
    expect(() => createServer({ dir: appDir(), assets: ASSETS, loadPage: {} }))
      .toThrow(/loadPage.*function/)
  })

  it('rejects a development loader without supplied assets', () => {
    expect(() => createServer({ dir: appDir(), dev: true, loadPage: async () => null }))
      .toThrow(/loadPage.*assets/)
  })
})

describe('development rendering and compilation', () => {
  beforeEach(() => HotReloader.mockReset())

  it.each([true, false])('renders supplied assets with dev=%s without starting the legacy compiler', async dev => {
    const failure = new Error('page rendering failed')
    const app = createServer({ dir: appDir(), dev, assets: ASSETS })
    await app.prepare()
    const markup = await renderThroughServer(app, '/_error', { err: failure })
    await app.close()

    expect(loadingTags(markup).moduleScripts).toEqual([ERROR_PAGE.entry])
    expect(nextData(markup).buildId).toBe(ASSETS.buildId)
    expect(nextData(markup).err).toEqual(dev
      ? { name: 'Error', message: failure.message, stack: failure.stack }
      : { message: '500 - Internal Server Error.' })
    expect(HotReloader).not.toHaveBeenCalled()
  })

  it('rejects malformed supplied assets in development', () => {
    expect(() => createServer({
      dir: appDir(),
      dev: true,
      assets: { ...ASSETS, pages: PAGES_WITHOUT_ERROR_PAGE }
    })).toThrow(/_error/)
    expect(HotReloader).not.toHaveBeenCalled()
  })

  it('starts and stops the legacy compiler in development without supplied assets', async () => {
    const compiler = { start: jest.fn(), stop: jest.fn() }
    HotReloader.mockImplementation(() => compiler)
    const app = createServer({ dir: appDir(), dev: true })
    await app.prepare()
    expect(HotReloader).toHaveBeenCalledTimes(1)
    expect(compiler.start).toHaveBeenCalledWith(['_error', '_document', '_amp'])
    const server = { route: jest.fn() }
    app.defineRoutes(server)
    expect(server.route.mock.calls.map(([route]) => route.path)).toEqual([
      '/_next/webpack-hmr', '/_next/{path*}', '/_static/{path*}'
    ])
    await app.close()
    expect(compiler.stop).toHaveBeenCalledTimes(1)
  })
})

describe('static asset route ownership', () => {
  it.each([true, false])('registers no routes with supplied assets and dev=%s', dev => {
    const app = createServer({ dir: appDir(), dev, assets: ASSETS })
    const server = { route: jest.fn() }
    app.defineRoutes(server)
    expect(server.route).not.toHaveBeenCalled()
  })

  it('keeps the legacy static URLs and directories without supplied assets', () => {
    const dir = appDir({ files: {
      '.next/BUILD_ID': 'build-1',
      '.next/webpack-entrypoints.json': JSON.stringify({ default: ENTRYPOINTS })
    } })
    const app = createServer({ dir })
    const server = { route: jest.fn() }
    app.defineRoutes(server)
    expect(server.route.mock.calls.map(([route]) => route)).toEqual([
      { method: 'GET', path: '/_next/{path*}', handler: { directory: { path: '.next/bundles/' } } },
      { method: 'GET', path: '/_static/{path*}', handler: { directory: { path: '.next/static/' } } }
    ])
  })
})
