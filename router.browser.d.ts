import { PageComponent } from './index.js'

export interface RouteLocation {
  pathname: string
  query: Record<string, unknown>
  asPath: string
}

type QueryValue = string | number | boolean
export type NavigationUrl = string | {
  pathname: string
  query?: Record<string, QueryValue | readonly QueryValue[] | undefined>
  hash?: string
}

export interface NavigationOptions {
  shallow?: boolean
}

export interface RouteInfo {
  Component: PageComponent
  props?: object
  err?: unknown
}

/**
 * A mitt emitter. The router emits `routeChangeStart` and `routeChangeComplete`
 * with the displayed URL; applications may emit their own events on it.
 */
export const events: import('mitt').Emitter

export function createRouter(
  pathname: string,
  query: RouteLocation['query'],
  as: string,
  routeInfo: RouteInfo,
  subscriber: (routeInfo: RouteInfo) => void
): void

declare const SingletonRouter: {
  route?: string
  url?: RouteLocation
  push(url: NavigationUrl, as: NavigationUrl | undefined, options: NavigationOptions): Promise<boolean> | void
  replace(url: NavigationUrl, as: NavigationUrl | undefined, options: NavigationOptions): Promise<boolean> | void
}
export default SingletonRouter
