import { PageComponent } from './index.js'

export function registerPage(
  route: string,
  load: () => { page: PageComponent } | { error: Error }
): void
export function waitForPage(route: string): Promise<PageComponent>
