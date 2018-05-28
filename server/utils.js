import { join, relative, resolve } from 'path'
import { readdirSync, existsSync } from 'fs'

export const IS_BUNDLED_PAGE = /^pages.*\.js$/
export const MATCH_ROUTE_NAME = /^pages[/\\](.*)\.js$/

export const nextModuleDir = resolve(__dirname, '..', '..', '..')
export const nextNodeModulesDir = join(nextModuleDir, 'node_modules')

// Maps all index.js files to the parent folder name, except for the root one. This allows
// the client to predictivly match file content without needing to know anything about
// the input file structure.
export function normalizePageEntryName (pathname, dir) {
  const pagesDir = join(dir, 'pages')
  return join('pages', relative(pagesDir, pathname).replace(/[/|\\]index\.js$/, '.js'))
}

export function getAvailableChunks (dir, dist) {
  const chunksDir = join(dir, dist, 'chunks')
  if (!existsSync(chunksDir)) return {}

  const chunksMap = {}
  const chunkFiles = readdirSync(chunksDir)

  chunkFiles.forEach(filename => {
    if (/\.js$/.test(filename)) {
      chunksMap[filename] = true
    }
  })

  return chunksMap
}

export function printAndExit (message, code = 1) {
  if (code === 0) {
    console.log(message)
  } else {
    console.error(message)
  }

  process.exit(code)
}
