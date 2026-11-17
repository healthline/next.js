import { Component, HTMLAttributes, ReactNode } from 'react'
import { PageResult } from './index.js'

export type DocumentPage = Partial<PageResult>

export interface DocumentContext<InitialProps = unknown, Page extends DocumentPage = DocumentPage> {
  initialProps: InitialProps
  renderPage(): Page
}

export interface DocumentInitialProps extends Pick<DocumentPage, 'html' | 'head' | 'errorHtml'> {
  styles?: ReactNode
}

export interface DocumentProps extends DocumentInitialProps {
  __NEXT_DATA__: {
    buildId: string
    pathname?: string
    props: unknown
    query: unknown
    publicPath: string
    err: unknown
  }
  dev: boolean
}

export default class Document<Props extends object = object> extends Component<DocumentProps & Props> {
  static getInitialProps(context: DocumentContext): DocumentInitialProps | Promise<DocumentInitialProps>
}

export interface HeadProps extends Omit<HTMLAttributes<HTMLHeadElement>, 'dangerouslySetInnerHTML'> {
  amp?: boolean
}

export class Head extends Component<HeadProps> {}
export class Main extends Component<Pick<HTMLAttributes<HTMLDivElement>, 'className'>> {}
export class NextScript extends Component<Pick<HTMLAttributes<HTMLScriptElement>, 'nonce'>> {}
