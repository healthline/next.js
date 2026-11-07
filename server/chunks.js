// The one exclusion set for chunk files that must not reach a page's markup,
// shared by server/render.js (building the entrypoints prop from a webpack
// compilation) and server/document.js (filtering whatever entrypoints it is
// handed). A page the site's Vite build produced renders from Vite's own
// manifest and does not pass through this filter.
//
// Two kinds are excluded, matched at the end of the name: hot-update chunks
// (`pages/index.a1b2c3.hot-update.js`), which a development incremental
// compile deletes before the browser can fetch them, and source maps (`.map`).
// `.hot-update.json` is left servable: webpack 4 never puts it on
// `chunk.files`.
const EXCLUDED_CHUNK = /(?:\.hot-update\.js|\.map)$/

export const isServableChunk = (file) => !EXCLUDED_CHUNK.test(file)
