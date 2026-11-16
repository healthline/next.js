import { Component, ReactElement } from 'react'
import { NavigationUrl } from './router.browser.js'

export interface LinkProps {
  href: NavigationUrl
  as?: NavigationUrl
  replace?: boolean
  shallow?: boolean
  passHref?: boolean
  scroll?: boolean
  children: ReactElement | string
  onError?: (error: unknown) => void
}

export default class Link extends Component<LinkProps> {}

// Lets the ESM declaration name the default class as a type.
export type { Link }
