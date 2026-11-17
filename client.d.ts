import { ComponentType, ReactElement } from 'react'
import { PageComponent } from './index.js'
import router, { RouteInfo } from './router.js'

interface RenderEvent {
  Component?: PageComponent
  ErrorComponent: PageComponent
  appProps: RouteInfo & { router: typeof router }
}

type RenderEventName = 'before-reactdom-render' | 'after-reactdom-render'
type RenderEventHandler = (event: RenderEvent) => void

export const emitter: {
  on(type: RenderEventName, handler: RenderEventHandler): void
  off(type: RenderEventName, handler: RenderEventHandler): void
  emit(type: RenderEventName, event: RenderEvent): void
}

export function setEnhancer(enhancer: ComponentType<{ children: ReactElement }>): void
export function render(route: Partial<RouteInfo>): Promise<void>
export function renderError(error: unknown): Promise<void>
export default function initialize(): Promise<typeof emitter>
