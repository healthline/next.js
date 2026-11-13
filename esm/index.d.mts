import implementation from '../index.js'
import type { DefaultExport } from './interop.mjs'

declare const entry: DefaultExport<typeof implementation>
export default entry
export * from '../index.js'
