// Based on https://github.com/airbnb/babel-plugin-dynamic-import-webpack
// We've added support for SSR with this version
import template from 'babel-template'
import syntax from 'babel-plugin-syntax-dynamic-import'
import { dirname, relative, resolve } from 'path'

const TYPE_IMPORT = 'Import'

const buildImport = (args) => (template(`
  (
    typeof window === 'undefined' ?
      new (require('next/dynamic').SameLoopPromise)((resolve, reject) => {
        eval('require.ensure = function (deps, callback) { callback(require) }')
        require.ensure([], (require) => {
          let m = require(SOURCE)
          m.__webpackChunkName = '${args.name}.js'
          resolve(m);
        }, 'chunks/${args.name}.js');
      })
      :
      new (require('next/dynamic').SameLoopPromise)((resolve, reject) => {
        const weakId = require.resolveWeak(SOURCE)
        try {
          const weakModule = __webpack_require__(weakId)
          return resolve(weakModule)
        } catch (err) {}

        require.ensure([], (require) => {
          try {
            let m = require(SOURCE)
            resolve(m)
          } catch(error) {
            reject(error)
          }
        }, 'chunks/${args.name}.js');
      })
  )
`))

export default () => ({
  inherits: syntax,

  visitor: {
    CallExpression (path) {
      if (path.node.callee.type === TYPE_IMPORT) {
        const { opts } = path.hub.file

        const moduleName = path.node.arguments[0].value
        const currentDir = dirname(opts.filename)
        const modulePath = resolve(currentDir, moduleName)
        const chunkName = relative(opts.sourceRoot, modulePath).replace(/[^\w]/g, '-')

        const newImport = buildImport({
          name: chunkName
        })({
          SOURCE: path.node.arguments
        })
        path.replaceWith(newImport)
      }
    }
  }
})
