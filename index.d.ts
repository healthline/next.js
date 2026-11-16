import { Component, ComponentType, ReactElement } from 'react'

/**
 * The browser files one page loads. URLs go into tags without an added prefix.
 * Stylesheets precede module preloads in the head. All loading tags use
 * anonymous CORS. The document nonce applies to the inline startup script.
 */
export interface PageAssets {
  /**
   * The page's ES module entry script, loaded with `<script type="module">`.
   * It is the only script the page loads, including when it renders an error.
   * It must register this route and `/_error` with `@healthline/next/page-loader`
   * and call `@healthline/next/client`'s default export. The browser waits for
   * both pages before hydrating, and reports nothing if either never registers.
   */
  entry: string
  /** Stylesheets, linked with `<link rel="stylesheet">` in this order. */
  stylesheets: string[]
  /** ES modules to preload with `<link rel="modulepreload">`. */
  preloads: string[]
}

/**
 * The page files of one build. Every URL is a string starting with
 * `http://`, `https://` or a single `/`; a browser reads `//` and `/\` as a
 * host name.
 */
export interface BuildAssets {
  /** Identifies this build. Non-empty. */
  buildId: string
  /**
   * Keyed by route, the page's `__NEXT_DATA__.pathname`, such as `/article` or
   * `/foo/bar`. Every route the site can render, including `/_error`. A key
   * starts with a single `/`. Use the pathname returned by `renderPage` as the
   * key. For example, `/article/index` becomes `/article`, while `/` and
   * `/index` remain distinct. Only the deprecated `doDocRender`, given webpack
   * `entrypoints` by hand, can render a route missing here.
   */
  pages: { [route: string]: PageAssets }
}

/** A route can return a component with its own props. Narrow the component before rendering it. */
export type PageComponent =
  | ((props: never) => ReactElement | null)
  | (new (props: never) => Pick<Component, 'render'>)

/**
 * Maps a logical template ID, such as `/article` or `/_document`, to its React component.
 * A template ID identifies page code, not a reader's URL such as `/health/example`.
 * Return the component itself, including for `/_document`, `/_amp`, and `/_error`.
 * The consumer owns module unwrapping, caching and invalidation. Throw or reject
 * on failure; `@healthline/next` neither caches the result nor falls back to a file.
 */
export type LoadPage = (templateId: string) => PageComponent | Promise<PageComponent>

export interface ServerOptions {
  /** The app directory, which holds `.next`. Defaults to `.`. */
  dir?: string
  dev?: boolean
  quiet?: boolean
  /**
   * Omit to load server components from `.next/server/pages`. With `dev`, also
   * supply `assets`: legacy development compiles only pages it loads from disk.
   */
  loadPage?: LoadPage
  /** Accepted and ignored. */
  conf?: unknown
  /**
   * Checked at startup. Supplying assets disables legacy compilation,
   * while `dev` still enables rendering diagnostics. Without `loadPage`, server
   * components then come from the existing `.next/server/pages`, which nothing
   * recompiles. The server reads none of `next.config.js`, `.next/BUILD_ID`,
   * `.next/webpack-entrypoints.json` or `SITE`. The consumer serves the supplied
   * URLs. `defineRoutes` registers no static or HMR routes.
   */
  assets?: BuildAssets
}

/** Legacy configuration for the standalone rendering functions. Prefer Server methods. */
export interface RenderOptions {
  dev: boolean
  dir: string
  hotReloader: unknown
  loadPage?: LoadPage
  /** URL prefix for webpack entrypoints. Supplied asset URLs already include their prefix. */
  publicPath: string
  buildId: string
  entrypoints: WebpackEntrypoints | undefined
  /** The checked copy of `ServerOptions.assets`. Webpack-only callers omit it. */
  assets?: Readonly<BuildAssets> | undefined
}

export type WebpackEntrypoints = Record<string, { chunks: { file: string; module: boolean }[] }>

/** Per-request behavior; build and loading configuration stays on the server. */
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
  renderPage<Props extends object | null | undefined, Query> (
    req: { url: string },
    res: unknown,
    pathname: string,
    query: Query,
    initialProps: Props,
    options?: PageRenderOptions<NonNullable<Props>>
  ): Promise<PageResult<Props extends null | undefined ? unknown : Props, Query>>
  /**
   * Render the document after any consumer processing of the page result.
   * With supplied assets and a pathname, the page supplies the route, props,
   * query and error sent to the browser. A route-less seed render uses the
   * Document's initial props instead.
   */
  renderDocument<Page extends Partial<PageResult>> (
    page: Page,
    initialProps: unknown,
    options?: DocumentRenderOptions
  ): Promise<string>
  /** @deprecated Use renderPage and renderDocument; configuration stays on the instance. */
  renderOpts: RenderOptions
  prepare (): Promise<void>
  close (): Promise<void>
  defineRoutes (server: unknown): void
  getCompilationError (): Promise<unknown>
}

export default function createServer (options?: ServerOptions): Server

export const $HEAD: unique symbol

/** @deprecated Use Server.renderPage to retain configuration on the instance. */
export function doPageRender<Props extends object | null | undefined, Query> (
  req: object,
  res: unknown,
  pathname: string,
  query: Query,
  initialProps: Props,
  options: Partial<RenderOptions> & Pick<RenderOptions, 'dev' | 'dir' | 'publicPath'> & PageRenderOptions<NonNullable<Props>>
): Promise<PageResult<Props extends null | undefined ? unknown : Props, Query>>

/** @deprecated Use Server.renderDocument to retain configuration on the instance. */
export function doDocRender<Page extends Partial<PageResult>> (
  page: Page,
  initialProps: unknown,
  options: RenderOptions & DocumentRenderOptions
): Promise<string>

export function serializeError (dev: boolean, err: unknown): unknown
