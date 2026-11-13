import implementation from '../document.js'
import type { DefaultExport } from './interop.mjs'

declare const entry: DefaultExport<typeof implementation>
export default entry
export * from '../document.js'
