import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Document from '../server/document'
import Server from '../server'

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
// by its `name`. The two imported chunks share a third, and the entry and one
// shared chunk each import something only dynamically.
const VITE_MANIFEST = {
  outDir: OUT_DIR,
  manifest: {
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

// Webpack still builds every page, the homepage included, while both toolchains build pages.
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

// The URLs of the loading tags in a document, by kind, in document order, and
// every script and link tag with its attributes. Attributes are read by name,
// so their order and quoting do not matter.
const loadingTags = (markup) => {
  const tags = { moduleScripts: [], modulepreloads: [], stylesheets: [], preloads: [], elements: [] }
  for (const [, tag, source] of markup.matchAll(/<(script|link)\b([^>]*)>/g)) {
    const attrs = {}
    for (const [, name, quoted, bare] of source.matchAll(/([a-z-]+)(?:=(?:"([^"]*)"|([^\s"]+)))?/g)) {
      attrs[name] = quoted !== undefined ? quoted : bare
    }
    tags.elements.push({ tag, ...attrs })
    if (tag === 'script' && attrs.type === 'module' && attrs.src) tags.moduleScripts.push(attrs.src)
    if (tag === 'link' && attrs.rel === 'modulepreload') tags.modulepreloads.push(attrs.href)
    if (tag === 'link' && attrs.rel === 'stylesheet') tags.stylesheets.push(attrs.href)
    if (tag === 'link' && attrs.rel === 'preload') tags.preloads.push(attrs.href)
  }
  return tags
}

describe("a page the site's Vite build produced", () => {
  let tags

  beforeAll(() => {
    tags = loadingTags(renderDocument({ pathname: '/home-page', viteManifest: VITE_MANIFEST }))
  })

  it('loads its Vite entry as the only module script on the page', () => {
    expect(tags.moduleScripts).toEqual([url('assets/pages/home-page-AAAA.js')])
  })

  it('preloads every chunk the entry imports statically, however deep, once each', () => {
    // The guide's order: a chunk's own imports before the chunk.
    expect(tags.modulepreloads).toEqual([
      url('assets/shared-EEEE.js'),
      url('assets/header-BBBB.js'),
      url('assets/footer-CCCC.js')
    ])
  })

  it('does not preload what the page only imports dynamically', () => {
    expect(tags.modulepreloads).not.toContain(url('assets/newsletter-GGGG.js'))
    expect(tags.modulepreloads).not.toContain(url('assets/form-HHHH.js'))
  })

  it("links the stylesheets of the entry and of the chunks it imports, the entry's first", () => {
    expect(tags.stylesheets).toEqual([
      url('assets/home-page-DDDD.css'),
      url('assets/shared-FFFF.css')
    ])
  })

  it('gets none of the webpack tags, although webpack also built the page', () => {
    expect(tags.preloads).toEqual([])
  })
})

describe('a page only webpack built', () => {
  // Frontend serves every template not yet on Vite through webpack, so a Vite
  // manifest for the site's other pages must not change this page's markup.
  const render = (viteManifest) => renderDocument({ pathname: '/standard', viteManifest })
  const files = ENTRYPOINTS['pages/standard.js'].chunks.map(({ file }) => file)

  it("preloads and then loads webpack's chunks for the page, after __NEXT_DATA__", () => {
    const markup = render(undefined)

    expect(loadingTags(markup).elements).toEqual([
      ...files.map((file) => ({
        tag: 'link',
        rel: 'preload',
        href: `${PUBLIC_PATH}${file}`,
        as: 'script',
        crossorigin: 'anonymous'
      })),
      { tag: 'script' },
      ...files.map((file) => ({
        tag: 'script',
        type: 'module',
        src: `${PUBLIC_PATH}${file}`,
        crossorigin: 'anonymous',
        async: ''
      }))
    ])
    expect(markup.match(/<script>([^<]*)<\/script>/)[1]).toBe(
      '__NEXT_DATA__={"buildId":"build-1","props":{},"pathname":"/standard","query":{},"publicPath":"https://assets.example.test/prefix/_next/","err":null}'
    )
  })

  it('renders the same markup when the site has a Vite manifest for its other pages', () => {
    expect(render(VITE_MANIFEST)).toBe(render(undefined))
  })
})

// doDocRender loads the consumer's document from the build's server tree, so
// these write one into a scratch build directory.
const buildDirWithDocument = (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'next-vite-manifest-'))
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

describe("the site's Vite manifest, as the server loads it at startup", () => {
  // The build writes .next/vite-manifests/<BUILD_ID>-<site>.json; server/index.js
  // documents the contract.
  const SITE = 'hl'
  let site

  beforeEach(() => {
    site = process.env.SITE
    process.env.SITE = SITE
  })

  afterEach(() => {
    if (site === undefined) {
      delete process.env.SITE
    } else {
      process.env.SITE = site
    }
  })

  const buildDir = (viteManifests = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'next-vite-manifest-load-'))
    mkdirSync(join(dir, '.next', 'vite-manifests'), { recursive: true })
    writeFileSync(join(dir, '.next', 'BUILD_ID'), 'build-1')
    writeFileSync(join(dir, '.next', 'webpack-entrypoints.json'), JSON.stringify({ [SITE]: ENTRYPOINTS }))
    for (const [name, content] of Object.entries(viteManifests)) {
      writeFileSync(join(dir, '.next', 'vite-manifests', name), content)
    }
    return dir
  }

  const loaded = (dir) => new Server({ dir }).renderOpts.viteManifest

  it("is absent when the build wrote none, so every page renders from webpack's entries", () => {
    expect(loaded(buildDir())).toBeUndefined()
  })

  it('is the outDir and Vite manifest the build wrote for this build and site', () => {
    const dir = buildDir({ 'build-1-hl.json': JSON.stringify(VITE_MANIFEST) })

    expect(loaded(dir)).toEqual(VITE_MANIFEST)
  })

  it('ignores a file an earlier build left behind', () => {
    const dir = buildDir({ 'build-0-hl.json': JSON.stringify(VITE_MANIFEST) })

    expect(loaded(dir)).toBeUndefined()
  })

  it.each([
    ["Vite's bare manifest, with no outDir", JSON.stringify(VITE_MANIFEST.manifest), /must be \{ outDir, manifest \}/],
    ['an absolute outDir', JSON.stringify({ ...VITE_MANIFEST, outDir: '/srv/app/.next/bundles/build-1/hl/vite' }), /must be \{ outDir, manifest \}/],
    ['an outDir that climbs out of .next/bundles', JSON.stringify({ ...VITE_MANIFEST, outDir: '../server' }), /must be \{ outDir, manifest \}/],
    ['an outDir with no manifest', JSON.stringify({ outDir: OUT_DIR }), /must be \{ outDir, manifest \}/],
    ['a manifest with no outDir', JSON.stringify({ manifest: VITE_MANIFEST.manifest }), /must be \{ outDir, manifest \}/],
    ['not JSON', '{', SyntaxError]
  ])('refuses to start when the file holds %s', (_, content, error) => {
    const dir = buildDir({ 'build-1-hl.json': content })

    expect(() => loaded(dir)).toThrow(error)
  })

  const withChunks = (chunks) =>
    JSON.stringify({ ...VITE_MANIFEST, manifest: { ...VITE_MANIFEST.manifest, ...chunks } })

  it('refuses to start when a chunk imports a key the manifest lacks, naming the file, chunk and key', () => {
    const dir = buildDir({
      'build-1-hl.json': withChunks({
        '_header-BBBB.js': { file: 'assets/header-BBBB.js', imports: ['_gone-ZZZZ.js'] }
      })
    })
    const path = join(dir, '.next', 'vite-manifests', 'build-1-hl.json')

    expect(() => new Server({ dir })).toThrow(
      `${path}: manifest chunk "_header-BBBB.js" imports "_gone-ZZZZ.js", which is not a key in the manifest`
    )
  })

  it.each([
    ['a chunk that is not an object', { '_x.js': 'assets/x.js' }, /"_x\.js" is not an object/],
    ['a chunk with no file', { '_x.js': { name: 'x' } }, /"_x\.js" has no string `file`/],
    ['a chunk whose css is not a list of files', { '_x.js': { file: 'x.js', css: 'x.css' } }, /"_x\.js" has a `css`/],
    ['a chunk whose imports is not a list of keys', { '_x.js': { file: 'x.js', imports: '_y.js' } }, /"_x\.js" has an `imports`/]
  ])('refuses to start when the manifest has %s', (_, chunks, error) => {
    const dir = buildDir({ 'build-1-hl.json': withChunks(chunks) })

    expect(() => loaded(dir)).toThrow(error)
  })
})
