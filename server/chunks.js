// The one exclusion set for chunk files that must not reach a page's markup,
// shared by server/render.js (building the entrypoints prop from a webpack
// compilation) and server/document.js (filtering whatever entrypoints it is
// handed). A page the site's Vite build produced renders from Vite's own
// manifest and does not pass through this filter.
//
// Two kinds are excluded: hot-update chunks (`pages/index.a1b2c3.hot-update.js`),
// which a development incremental compile deletes before the browser can fetch
// them, and source maps (`.map`), which are never executable and which devtools
// fetch on their own. The two readers used to disagree about `.map`, so both
// now call this predicate.
//
// The pattern is anchored at the end of the name. The unanchored regexes it
// replaces also dropped a legitimately named chunk such as
// `pages/hot-update-notes.js`.
//
// `.hot-update.json` is deliberately left servable. Under webpack 4.47.0,
// HotModuleReplacementPlugin pushes only the per-chunk update (named by
// `output.hotUpdateChunkFilename`, default `[id].[hash].hot-update.js`) onto
// `chunk.files`. The update manifest (`[hash].hot-update.json`) is emitted
// without that push, so it never reaches this predicate. A search of
// six-million 8.2.1 found no override of either name, so the defaults hold.
// test/document-public-path.test.js pins the `.json` name as servable so the
// decision is visible.
//
// The document applies the filter to its own input as well, rather than
// trusting whichever build wrote the entrypoints it is handed.
const EXCLUDED_CHUNK = /(?:\.hot-update\.js|\.map)$/

export const isServableChunk = (file) => !EXCLUDED_CHUNK.test(file)
