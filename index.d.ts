import { Component, ComponentType, ReactElement } from 'react'

/** A route can return a component with its own props. Narrow the component before rendering it. */
export type PageComponent =
  | ((props: never) => ReactElement | null)
  | (new (props: never) => Pick<Component, 'render'>)

export interface ServerOptions {
  /** The app directory, which holds `.next`. Defaults to `.`. */
  dir?: string
  dev?: boolean
  quiet?: boolean
  /** Accepted and ignored. */
  conf?: unknown
}

/** Configuration for the standalone rendering functions. */
export interface RenderOptions {
  dev: boolean
  dir: string
  hotReloader: unknown
  /** URL prefix for webpack entrypoints. */
  publicPath: string
  buildId: string
  entrypoints: WebpackEntrypoints | undefined
}

export type WebpackEntrypoints = Record<string, { chunks: { file: string; module: boolean }[] }>

/** Options for rendering one page. */
export interface PageRenderOptions<Props extends object = never> {
  /** Component ID to load when it differs from the rendered pathname. */
  page?: string
  err?: unknown
  enhancer?: (component: ComponentType<Props>) => ComponentType<Props>
  overloadCheck?: () => boolean
}

export interface DocumentRenderOptions {
  amp?: boolean
}

/** The consumer may process these fields before rendering the document. */
export interface PageResult<Props = unknown, Query = unknown> {
  pathname: string
  props: Props
  query: Query
  head: unknown
  html?: string
  errorHtml?: string
  publicPath?: string
  err?: unknown
}

export interface Server {
  renderOpts: RenderOptions
  prepare (): Promise<void>
  close (): Promise<void>
  defineRoutes (server: unknown): void
  getCompilationError (): Promise<unknown>
}

export default function createServer (options?: ServerOptions): Server

export const $HEAD: unique symbol

export function doPageRender<Props extends object | null | undefined, Query> (
  req: object,
  res: unknown,
  pathname: string,
  query: Query,
  initialProps: Props,
  options: Partial<RenderOptions> & Pick<RenderOptions, 'dev' | 'dir' | 'publicPath'> & PageRenderOptions<NonNullable<Props>>
): Promise<PageResult<Props extends null | undefined ? unknown : Props, Query>>

export function doDocRender<Page extends Partial<PageResult>> (
  page: Page,
  initialProps: unknown,
  options: RenderOptions & DocumentRenderOptions
): Promise<string>

export function serializeError (dev: boolean, err: unknown): unknown
