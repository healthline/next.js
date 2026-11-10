import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { JSDOM } from 'jsdom'
import Document from '../server/document'
import createServer from '../server/next'

// A page the site's Vite build produced renders the way Vite's
// backend-integration guide renders an entry from the manifest (vitejs/vite
// v8.0.10, docs/guide/backend-integration.md): stylesheets, one module script
// for the entry, and a modulepreload for each chunk it imports statically.
// Every other page renders from webpack's entries exactly as before.

const PUBLIC_PATH = 'https://assets.example.test/prefix/_next/'
const OUT_DIR = 'build-1/hl/vite'
const url = (file) => `${PUBLIC_PATH}${OUT_DIR}/${file}`

// Shaped like the guide's example and like the homepage's real manifest: keys
// are source paths or `_`-prefixed shared chunks, and a page's entry is found
// by its `name`. Another page's entry comes first, so the first entry is the
// wrong one. The homepage's two imported chunks share a third, and its entry
// and one shared chunk each import something only dynamically.
const VITE_MANIFEST = {
  outDir: OUT_DIR,
  manifest: {
    'client/vite-article.js': {
      file: 'assets/pages/article-JJJJ.js',
      name: 'pages/article',
      src: 'client/vite-article.js',
      isEntry: true
    },
    'client/vite-home-page.js': {
      file: 'assets/pages/home-page-AAAA.js',
      name: 'pages/home-page',
      src: 'client/vite-home-page.js',
      isEntry: true,
      imports: ['_header-BBBB.js', '_footer-CCCC.js'],
      dynamicImports: ['lib/newsletter.js'],
      css: ['assets/home-page-DDDD.css']
    },
    '_header-BBBB.js': {
      file: 'assets/header-BBBB.js',
      name: 'header',
      imports: ['_shared-EEEE.js']
    },
    '_footer-CCCC.js': {
      file: 'assets/footer-CCCC.js',
      name: 'footer',
      imports: ['_shared-EEEE.js']
    },
    '_shared-EEEE.js': {
      file: 'assets/shared-EEEE.js',
      name: 'shared',
      dynamicImports: ['lib/newsletter.js'],
      css: ['assets/shared-FFFF.css']
    },
    'lib/newsletter.js': {
      file: 'assets/newsletter-GGGG.js',
      name: 'newsletter',
      src: 'lib/newsletter.js',
      isDynamicEntry: true,
      imports: ['_form-HHHH.js']
    },
    '_form-HHHH.js': {
      file: 'assets/form-HHHH.js',
      name: 'form'
    }
  }
}

// During the migration webpack still builds every page, the homepage included.
const ENTRYPOINTS = {
  'pages/standard.js': {
    chunks: [
      { file: 'build-1/hl/vendor.js', module: true },
      { file: 'build-1/hl/pages/standard.js', module: true },
      { file: 'standard-ab12c.js', module: true }
    ]
  },
  'pages/home-page.js': {
    chunks: [{ file: 'build-1/hl/pages/home-page.js', module: true }]
  }
}

const renderDocument = ({ pathname, viteManifest }) =>
  renderToStaticMarkup(
    createElement(Document, {
      __NEXT_DATA__: {
        buildId: 'build-1',
        props: {},
        pathname,
        query: {},
        publicPath: PUBLIC_PATH,
        err: null
      },
      entrypoints: ENTRYPOINTS,
      viteManifest,
      html: '<div>page</div>',
      head: `<title>${pathname.slice(1)}</title>`,
      errorHtml: '',
      styles: null,
      dev: false
    })
  )

const parse = (markup) => new JSDOM(markup).window.document

// The URLs of a document's loading tags, by kind, in document order, and the
// `src` of every script in document order (null for an inline script). The
// markup is parsed as HTML, so attribute order and quoting do not matter.
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

describe("a page the site's Vite build produced", () => {
  let tags

  beforeAll(() => {
    tags = loadingTags(renderDocument({ pathname: '/home-page', viteManifest: VITE_MANIFEST }))
  })

  it('loads its Vite entry as the only module script on the page', () => {
    expect(tags.moduleScripts).toEqual([url('assets/pages/home-page-AAAA.js')])
  })

  it('preloads the chunks the entry imports statically, however deep, once each, and no others', () => {
    // Sorted, because preload order changes nothing a browser does. The
    // newsletter and form chunks are absent: the page imports them only
    // dynamically, so they load when the page asks for them.
    expect([...tags.modulepreloads].sort()).toEqual([
      url('assets/footer-CCCC.js'),
      url('assets/header-BBBB.js'),
      url('assets/shared-EEEE.js')
    ])
  })

  it("links the stylesheets of the entry and of the chunks it imports, the entry's first", () => {
    // In order, because stylesheet order decides which rule wins.
    expect(tags.stylesheets).toEqual([
      url('assets/home-page-DDDD.css'),
      url('assets/shared-FFFF.css')
    ])
  })

  // VITE-MIGRATION(webpack-deletion): Delete this test once no site builds pages with webpack.
  it('gets no webpack preload links, although webpack also built the page', () => {
    expect(tags.preloads).toEqual([])
  })
})

// VITE-MIGRATION(webpack-deletion): Delete this describe once no site builds
// pages with webpack. Move its __NEXT_DATA__ test into the Vite describe
// first: every page renders that inline script.
describe('a page only webpack built', () => {
  // Frontend serves every template not yet on Vite through webpack, so a Vite
  // manifest for the site's other pages must not change this page's markup.
  const render = (viteManifest) => renderDocument({ pathname: '/standard', viteManifest })
  const files = ENTRYPOINTS['pages/standard.js'].chunks.map(({ file }) => file)

  it("preloads and loads every webpack chunk of the page, in the build's order", () => {
    const tags = loadingTags(render(undefined))
    const chunkUrls = files.map((file) => `${PUBLIC_PATH}${file}`)

    expect(tags.preloads).toEqual(chunkUrls)
    expect(tags.moduleScripts).toEqual(chunkUrls)
    // The inline __NEXT_DATA__ script comes before every chunk, because the
    // client entry reads __NEXT_DATA__ as soon as it runs.
    expect(tags.scriptSources).toEqual([null, ...chunkUrls])
  })

  it('assigns only __NEXT_DATA__ in its inline script', () => {
    const inlineScript = parse(render(undefined)).querySelector('script:not([src])').textContent
    expect(inlineScript).toMatch(/^__NEXT_DATA__=\{/)
    // JSON.parse throws on anything after the object, such as a second assignment.
    expect(JSON.parse(inlineScript.slice('__NEXT_DATA__='.length))).toEqual({
      buildId: 'build-1',
      props: {},
      pathname: '/standard',
      query: {},
      publicPath: PUBLIC_PATH,
      err: null
    })
  })

  it('renders the same markup when the site has a Vite manifest for its other pages', () => {
    expect(render(VITE_MANIFEST)).toBe(render(undefined))
  })
})

// Scratch build directories, removed after the suite.
const scratchDirs = []
const scratchDir = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  scratchDirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

// doDocRender loads the site's own document (its pages/_document.js, built
// into .next/server/pages) from the build's server tree, so these write one
// into a scratch build directory.
const buildDirWithDocument = (source) => {
  const dir = scratchDir('next-vite-manifest-')
  const pageDir = join(dir, '.next', 'server', 'pages')
  mkdirSync(pageDir, { recursive: true })
  writeFileSync(join(pageDir, '_document.js'), source)
  return dir
}

// What doPageRender hands a consumer's document, reduced to what these read.
const pageAt = (pathname) => ({
  pathname,
  query: {},
  props: {},
  html: '<div>page</div>',
  head: ''
})

const docRender = (dir, pathname, viteManifest) => {
  const { doDocRender } = require('../server/render')
  return doDocRender(pageAt(pathname), {}, {
    dir,
    publicPath: PUBLIC_PATH,
    buildId: 'build-1',
    entrypoints: ENTRYPOINTS,
    viteManifest
  })
}

// Each document's getInitialProps passes the whole page through. Document's
// own returns only html, head and errorHtml, and doDocRender reads the
// pathname that picks the page's tags from what getInitialProps returns.
// Without the pass-through the render throws "No scripts found for undefined".
describe("doDocRender, for a page the site's Vite build produced", () => {
  it("hands the document the site's Vite manifest, so the page loads its Vite entry", async () => {
    const dir = buildDirWithDocument(`
      const Document = require(${JSON.stringify(require.resolve('../server/document'))}).default
      class RenderedPage extends Document {}
      RenderedPage.getInitialProps = async ({ renderPage }) => renderPage()
      module.exports = RenderedPage
    `)

    const markup = await docRender(dir, '/home-page', VITE_MANIFEST)

    expect(loadingTags(markup).moduleScripts).toEqual([url('assets/pages/home-page-AAAA.js')])
  })

  it("keeps the server's manifest when the document's getInitialProps returns one", async () => {
    const dir = buildDirWithDocument(`
      const Document = require(${JSON.stringify(require.resolve('../server/document'))}).default
      class OverridingPage extends Document {}
      OverridingPage.getInitialProps = async ({ renderPage }) => ({
        ...renderPage(),
        viteManifest: { outDir: 'elsewhere', manifest: {} }
      })
      module.exports = OverridingPage
    `)

    const markup = await docRender(dir, '/home-page', VITE_MANIFEST)

    expect(loadingTags(markup).moduleScripts).toEqual([url('assets/pages/home-page-AAAA.js')])
  })
})

// One build directory holds the builds of several sites (hl, mnt and others),
// and SITE names the one this server serves. Startup reads that site's entry
// points and Vite manifest. Set for every test in the file; only the tests
// that start a server read it.
const SITE = 'hl'
let siteBefore

beforeEach(() => {
  siteBefore = process.env.SITE
  process.env.SITE = SITE
})

afterEach(() => {
  if (siteBefore === undefined) {
    delete process.env.SITE
  } else {
    process.env.SITE = siteBefore
  }
})

const manifestPath = (dir, name) => join(dir, '.next', 'vite-manifests', name)

// A build directory as the build leaves it: BUILD_ID, without which the server
// exits the process, and webpack's entry points for two sites. Each of
// `viteManifests` is written to .next/vite-manifests as given, or as JSON
// when it is not a string.
const buildDirectory = ({ viteManifests = {} } = {}) => {
  const dir = scratchDir('next-vite-manifest-load-')
  mkdirSync(join(dir, '.next', 'vite-manifests'), { recursive: true })
  writeFileSync(join(dir, '.next', 'BUILD_ID'), 'build-1')
  writeFileSync(join(dir, '.next', 'webpack-entrypoints.json'), JSON.stringify({ hl: ENTRYPOINTS, mnt: ENTRYPOINTS }))
  for (const [name, content] of Object.entries(viteManifests)) {
    writeFileSync(manifestPath(dir, name), typeof content === 'string' ? content : JSON.stringify(content))
  }
  return dir
}

// The Vite manifest a server started on `dir` hands every render.
const viteManifestAtStartup = (dir, options = {}) =>
  createServer({ dir, ...options }).renderOpts.viteManifest

describe("the site's Vite manifest, as the server loads it at startup", () => {
  // The build writes .next/vite-manifests/<BUILD_ID>-<site>.json; server/index.js
  // documents the contract.

  it("is absent when the build wrote none, so every page renders from webpack's entries", () => {
    expect(viteManifestAtStartup(buildDirectory())).toBeUndefined()
  })

  it('is the outDir and Vite manifest the build wrote for this build and site', () => {
    const dir = buildDirectory({ viteManifests: { 'build-1-hl.json': VITE_MANIFEST } })

    expect(viteManifestAtStartup(dir)).toEqual(VITE_MANIFEST)
  })

  it("reads only its own site's file, because one build directory serves several sites", () => {
    const dir = buildDirectory({ viteManifests: { 'build-1-mnt.json': VITE_MANIFEST } })

    expect(viteManifestAtStartup(dir)).toBeUndefined()

    process.env.SITE = 'mnt'
    expect(viteManifestAtStartup(dir)).toEqual(VITE_MANIFEST)
  })

  it('ignores a file an earlier build left behind', () => {
    const dir = buildDirectory({ viteManifests: { 'build-0-hl.json': VITE_MANIFEST } })

    expect(viteManifestAtStartup(dir)).toBeUndefined()
  })

  // One row per rule the readme states for the file. outDir must be a path
  // under .next/bundles, the directory the public path serves.
  it.each([
    ['text that is not JSON', '{'],
    ['no outDir', { manifest: VITE_MANIFEST.manifest }],
    ['no manifest', { outDir: OUT_DIR }],
    ['an absolute outDir', { ...VITE_MANIFEST, outDir: '/srv/app/.next/bundles/build-1/hl/vite' }],
    ['an outDir with a `..` segment', { ...VITE_MANIFEST, outDir: 'build-1/../../server' }]
  ])('refuses to start when the file holds %s', (_, content) => {
    const dir = buildDirectory({ viteManifests: { 'build-1-hl.json': content } })

    expect(() => viteManifestAtStartup(dir)).toThrow()
  })

  // The homepage fixture with one more chunk, `_x.js`, that breaks a rule.
  const manifestWithChunk = (chunk) =>
    ({ ...VITE_MANIFEST, manifest: { ...VITE_MANIFEST.manifest, '_x.js': chunk } })

  // One row per rule the readme states for a chunk. The error has to say where
  // the problem is, so each refusal names the file and the chunk.
  it.each([
    ['is not an object', null],
    ['has no file', { name: 'x' }],
    ['has a css list holding a non-string', { file: 'x.js', css: [1] }],
    ['has an imports that is not a list', { file: 'x.js', imports: 5 }]
  ])('refuses to start when a chunk %s, naming the file and the chunk', (_, chunk) => {
    const dir = buildDirectory({ viteManifests: { 'build-1-hl.json': manifestWithChunk(chunk) } })
    const start = () => viteManifestAtStartup(dir)

    expect(start).toThrow(manifestPath(dir, 'build-1-hl.json'))
    expect(start).toThrow('"_x.js"')
  })

  it('refuses to start when a chunk imports a key the manifest lacks, naming the file, the chunk and the key', () => {
    const dir = buildDirectory({
      viteManifests: { 'build-1-hl.json': manifestWithChunk({ file: 'x.js', imports: ['_gone-ZZZZ.js'] }) }
    })
    const start = () => viteManifestAtStartup(dir)

    expect(start).toThrow(manifestPath(dir, 'build-1-hl.json'))
    expect(start).toThrow('"_x.js"')
    expect(start).toThrow('"_gone-ZZZZ.js"')
  })
})

// VITE-MIGRATION(webpack-deletion): when the `vite` option goes, keep the
// missing-manifest refusal as the test of the new default and delete the rest.
describe('the vite option, passed through the factory consumers call', () => {
  // Left out, the option reads the manifest when the build wrote one: the
  // startup tests above cover that default.

  it('never reads the manifest when false, so even a corrupt one cannot stop startup', () => {
    const dir = buildDirectory({ viteManifests: { 'build-1-hl.json': '{' } })

    expect(() => viteManifestAtStartup(dir, { vite: false })).not.toThrow()
    expect(viteManifestAtStartup(dir, { vite: false })).toBeUndefined()
  })

  it('reads the manifest when true', () => {
    const dir = buildDirectory({ viteManifests: { 'build-1-hl.json': VITE_MANIFEST } })

    expect(viteManifestAtStartup(dir, { vite: true })).toEqual(VITE_MANIFEST)
  })

  it('refuses to start when true and there is no manifest, naming the expected path', () => {
    const dir = buildDirectory()

    expect(() => viteManifestAtStartup(dir, { vite: true })).toThrow(manifestPath(dir, 'build-1-hl.json'))
  })

  it('rejects anything but true, false or nothing, such as the string an environment variable holds', () => {
    const dir = buildDirectory({ viteManifests: { 'build-1-hl.json': VITE_MANIFEST } })

    expect(() => viteManifestAtStartup(dir, { vite: 'true' })).toThrow(TypeError)
  })
})
