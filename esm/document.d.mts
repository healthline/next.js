import implementation from '../document.js'
import type { Document } from '../document.js'
import type { DefaultExport } from './interop.mjs'

declare const entry: DefaultExport<typeof implementation>
type entry<Props extends object = object> = Document<Props>
export default entry
export * from '../document.js'
