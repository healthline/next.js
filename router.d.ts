/** Per-request routing state returned by the Node entry. */
export default class RouterState<Query = Record<string, unknown>> {
  constructor(pathname: string, query: Query, as: string)
  route: string
  pathname: string
  query: Query
  asPath: string
}

/** Code that also runs in the browser may import this name. Events exist only there. */
export const events: undefined
