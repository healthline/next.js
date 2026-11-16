import implementation from '../router.js'
import type { RouterState } from '../router.js'
import type { DefaultExport } from './interop.mjs'

declare const entry: DefaultExport<typeof implementation>
type entry<Query = Record<string, unknown>> = RouterState<Query>
export default entry
export * from '../router.js'
