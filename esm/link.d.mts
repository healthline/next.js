import implementation from '../link.js'
import type { Link } from '../link.js'
import type { DefaultExport } from './interop.mjs'

declare const entry: DefaultExport<typeof implementation>
type entry = Link
export default entry
export * from '../link.js'
