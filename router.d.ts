/** Per-request routing state returned by the Node entry. */
export default class RouterState<Query = Record<string, unknown>> {
  constructor(pathname: string, query: Query, as: string)
  route: string
  pathname: string
  query: Query
  asPath: string
}

/** Shared modules may import this name. Events exist only in the browser. */
export const events: undefined

// Lets the ESM declaration name the default class as a type.
export type { RouterState }
