import { Component, ReactElement, ReactNode } from 'react'

export default class Head extends Component<{ children?: ReactNode }> {
  static peek(): ReactElement[] | undefined
  /** Returns the collected tags and clears them. Call only on the server. */
  static rewind(): ReactElement[] | undefined
}

export const defaultHead: ReactElement[]
