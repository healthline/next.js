const { globSync } = require('fs')
const path = require('path')
const { files } = require('../package.json')

const packageRoot = path.join(__dirname, '..')

// The current allowlist contains root-anchored includes. A directory match
// also includes its contents, as it does when Yarn packs the package.
module.exports = function publishedFiles () {
  return files.flatMap(pattern => {
    const include = pattern.replace(/^\//, '')
    const matches = globSync(include, { cwd: packageRoot })
    if (matches.length === 0) throw new Error(`No build files match package.json files entry "${pattern}". Run yarn build first.`)
    return globSync(matches.flatMap(match => [match, `${match}/**/*`]), { cwd: packageRoot, withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(entry.parentPath, entry.name))
  })
}
