import implementation from '../head.js'
import type { Head } from '../head.js'
import type { DefaultExport } from './interop.mjs'

declare const entry: DefaultExport<typeof implementation>
type entry = Head
export default entry
export * from '../head.js'
