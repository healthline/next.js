import { resolve, relative } from 'path'
import { nextModuleDir } from '../../utils'

module.exports = function (content, sourceMap) {
  this.cacheable()

  const route = getRoute(this)

  this.callback(null, `${content}
    require('next/page-loader').registerPage(${JSON.stringify(route)}, function() {
      return {
        page: typeof __webpack_exports__ !== 'undefined' ? __webpack_exports__.default : (module.exports.default || module.exports)
      }
    })
  `, sourceMap)
}

const nextPagesDir = resolve(nextModuleDir, 'pages')

function getRoute (loaderContext) {
  const pagesDir = resolve(loaderContext.rootContext, 'pages')
  const { resourcePath } = loaderContext
  const dir = [pagesDir, nextPagesDir]
    .find((d) => resourcePath.indexOf(d) === 0)
  const path = relative(dir, resourcePath)
  return '/' + path.replace(/((^|\/)index)?\.js$/, '')
}
