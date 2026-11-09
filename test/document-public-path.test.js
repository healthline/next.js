import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import Document from '../server/document'

// The document is the only place that turns a manifest entry into a URL, and
// it must do so from __NEXT_DATA__.publicPath alone -- no bundler global is
// available while the server renders. A publicPath on a different origin is
// used here so a URL built from anything else cannot accidentally match.

const PUBLIC_PATH = 'https://assets.example.test/prefix/_next/'
const CHUNK_FILES = ['main.js', 'pages/index.js']

function renderDocument (chunkFiles = CHUNK_FILES) {
  return renderToStaticMarkup(
    createElement(Document, {
      __NEXT_DATA__: {
        buildId: 'test-build',
        props: {},
        pathname: '/index',
        query: {},
        publicPath: PUBLIC_PATH,
        err: null
      },
      entrypoints: {
        'pages/index.js': {
          chunks: chunkFiles.map((file) => ({ file, module: true }))
        }
      },
      html: '<div>page</div>',
      head: '',
      errorHtml: '',
      styles: null,
      dev: false
    })
  )
}

const parse = (markup) => new JSDOM(markup).window.document

const attributeValues = (document, selector, name) =>
  Array.from(document.querySelectorAll(selector), (element) => element.getAttribute(name))

describe("the document's first inline script", () => {
  // The script's contract is one thing: __NEXT_DATA__ exists before any bundle
  // runs. It used to also assign a global `module = {}`, a shim for an
  // unguarded `module.hot` read that lib/page-loader.js no longer makes. The
  // negative assertion is the point of this test: while the shim was emitted,
  // an unguarded `module.*` read anywhere on the hydration path would work in
  // the browser and fail only under an ESM bundle.

  const inlineScript = (markup) => {
    const script = parse(markup).querySelector('script')
    return script ? script.textContent : null
  }

  it('assigns __NEXT_DATA__ and nothing else', () => {
    const script = inlineScript(renderDocument())

    expect(script).toMatch(/^__NEXT_DATA__=\{/)
    expect(script).not.toMatch(/\bmodule\s*=/)
  })
})

describe('the document, given chunks the browser must not be sent', () => {
  // Hot-update files are a development artifact of the incremental compile. They
  // must never reach a document's markup: by the time the browser parses the
  // tag the file is already gone, and a 404 on a script tag is a broken page.
  // A source map is not executable at all. The document filters its own input,
  // so a hot-update file or source map handed in by any caller never becomes a
  // script tag. The exclusion set lives in server/chunks.js and is shared with
  // server/render.js.

  const expectedURLs = CHUNK_FILES.map((file) => `${PUBLIC_PATH}${file}`)

  const urlsFor = (chunkFiles) => {
    const document = parse(renderDocument(chunkFiles))
    return {
      scripts: attributeValues(document, 'script[src]', 'src'),
      preloads: attributeValues(document, 'link[rel=preload]', 'href')
    }
  }

  it('emits no tag for a hot-update chunk, and keeps the other chunks', () => {
    const { scripts, preloads } = urlsFor([
      'main.js',
      'pages/index.a1b2c3.hot-update.js',
      'pages/index.js'
    ])

    expect(scripts).toEqual(expectedURLs)
    expect(preloads).toEqual(expectedURLs)
  })

  it('emits no tag for a source map, and keeps the other chunks', () => {
    // render.js dropped `.map` entries and the document did not.
    const { scripts, preloads } = urlsFor([
      'main.js',
      'pages/index.js.map',
      'pages/index.js'
    ])

    expect(scripts).toEqual(expectedURLs)
    expect(preloads).toEqual(expectedURLs)
  })

  it.each([
    'pages/hot-update-notes.js',
    'pages/map.js'
  ])('keeps %s, whose name merely contains an excluded word', (ownName) => {
    // The exclusion is anchored at the end of the name. The unanchored regexes
    // it replaces dropped any chunk with "hot-update" anywhere in its path,
    // which is a name an application is entitled to choose.
    const { scripts, preloads } = urlsFor([
      'main.js',
      ownName,
      'pages/index.js'
    ])

    expect(scripts).toEqual([
      `${PUBLIC_PATH}main.js`,
      `${PUBLIC_PATH}${ownName}`,
      `${PUBLIC_PATH}pages/index.js`
    ])
    expect(preloads).toEqual(scripts)
  })
})

describe('the renderer, building the entrypoints prop from a compilation', () => {
  // server/document.js filters whatever entrypoints it is handed; server/render.js
  // filters the ones it builds itself, out of a webpack compilation's chunk
  // files, before the document ever sees them. Only the shared predicate and
  // the document half were covered, so deleting the `.filter(isServableChunk)`
  // in doDocRender left both suites green. This drives that half: the document
  // stub reports the entrypoints prop verbatim, so the assertion observes what
  // the renderer chose to pass on.

  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs')
  const { join } = require('path')
  const { tmpdir } = require('os')

  // React is required by its resolved absolute path: the stub lives under
  // os.tmpdir(), from where a bare 'react' specifier does not resolve.
  const STUB_DOCUMENT = `
    const { createElement } = require(${JSON.stringify(require.resolve('react'))})
    module.exports = function Document ({ entrypoints }) {
      return createElement('div', { 'data-entrypoints': JSON.stringify(entrypoints) })
    }
    module.exports.getInitialProps = async ({ initialProps, renderPage }) => {
      renderPage()
      return { props: initialProps, pathname: '/index', query: {} }
    }
  `

  // The renderer reads chunk files off compilation.entrypoints, a Map of entry
  // name to an object whose `chunks` each carry a `files` array. This is the
  // smallest stand-in for that shape; hotReloader.multiStats.stats is the list
  // of per-compiler stats server/index.js hands the renderer.
  const compilationWith = (files) => ({
    entrypoints: new Map([
      ['pages/index.js', { chunks: [{ files }] }]
    ])
  })

  let dir

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'next-render-entrypoints-'))
    const pageDir = join(dir, '.next', 'server', 'pages')
    mkdirSync(pageDir, { recursive: true })
    writeFileSync(join(pageDir, '_document.js'), STUB_DOCUMENT)
  })

  const entrypointsFrom = async (files) => {
    const { doDocRender } = require('../server/render')
    const markup = await doDocRender(createElement('div'), {}, {
      dev: true,
      dir,
      publicPath: PUBLIC_PATH,
      buildId: 'test-build',
      hotReloader: { multiStats: { stats: [{ compilation: compilationWith(files) }] } }
    })
    const [, json] = markup.match(/data-entrypoints="([^"]*)"/)
    const decoded = json.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    return JSON.parse(decoded)['pages/index.js'].chunks.map(({ file }) => file)
  }

  it('passes on no hot-update chunk, and keeps the other chunks', async () => {
    await expect(entrypointsFrom([
      'main.js',
      'pages/index.a1b2c3.hot-update.js',
      'pages/index.js'
    ])).resolves.toEqual(CHUNK_FILES)
  })

  it('passes on no source map, and keeps the other chunks', async () => {
    await expect(entrypointsFrom([
      'main.js',
      'pages/index.js.map',
      'pages/index.js'
    ])).resolves.toEqual(CHUNK_FILES)
  })

  it('keeps a chunk whose name merely contains an excluded word', async () => {
    await expect(entrypointsFrom([
      'main.js',
      'pages/hot-update-notes.js',
      'pages/index.js'
    ])).resolves.toEqual(['main.js', 'pages/hot-update-notes.js', 'pages/index.js'])
  })
})
