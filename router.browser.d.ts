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

type RouteEvent = 'routeChangeStart' | 'routeChangeComplete'
type RouteEventHandler = (as: string) => void
// Any other name, typed as mitt types it. A route event name must use the
// route event signature, so it cannot carry another payload.
type OtherEvent<Type extends string> = Type & (Type extends RouteEvent ? never : unknown)
type OtherEventHandler = (event?: any) => void

/** A mitt emitter. The router emits the route events; applications may emit others. */
export const events: {
  on(type: RouteEvent, handler: RouteEventHandler): void
  on<Type extends string>(type: OtherEvent<Type>, handler: OtherEventHandler): void
  off(type: RouteEvent, handler: RouteEventHandler): void
  off<Type extends string>(type: OtherEvent<Type>, handler: OtherEventHandler): void
  emit(type: RouteEvent, as: string): void
  emit<Type extends string>(type: OtherEvent<Type>, event?: unknown): void
}

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
