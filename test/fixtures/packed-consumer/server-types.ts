import { createElement } from 'react'
import next, { doDocRender, doPageRender } from '@healthline/next'
import Document, { Head, Main, NextScript } from '@healthline/next/document'
import Link from '@healthline/next/link'
import PageHead from '@healthline/next/head'
import { registerPage } from '@healthline/next/page-loader'
import RouterState from '@healthline/next/router'

class ArticleDocument extends Document<{ section: string }> {
  static async getInitialProps(context: import('@healthline/next/document').DocumentContext) {
    const page = context.renderPage()
    return { ...page, html: page.html?.trim() }
  }

  render() {
    const { section, __NEXT_DATA__ } = this.props
    return createElement(Head, { amp: true },
      createElement('title', null, section + __NEXT_DATA__.buildId))
  }
}
void ArticleDocument
createElement(Main, { className: 'article' })
createElement(NextScript, { nonce: 'nonce' })
// @ts-expect-error Script nonces are strings.
createElement(NextScript, { nonce: 42 })
createElement(Link, { href: '/article', children: createElement('a', null, 'Article') })
PageHead.rewind()?.map(tag => tag.key)

const Article = ({ title }: { title: string }) => createElement('h1', null, title)
registerPage('/article', () => ({ page: Article }))
const app = next({ dir: '.' })
async function renderArticle () {
  const request = { url: '/health/sleep' }
  const page = await doPageRender(request, {}, '/article', { slug: 'sleep' }, { title: 'Sleep' }, app.renderOpts)
  page.query.slug.toUpperCase()
  page.props.title.toUpperCase()
  // @ts-expect-error The query's slug is inferred as a string.
  page.query.slug.toFixed()
  // @ts-expect-error The initial title prop is inferred as a string.
  page.props.title.toFixed()
  // @ts-expect-error The framework does not constrain a page's head representation.
  page.head.toUpperCase()
  await doDocRender(page, { config: {} }, app.renderOpts)
}
void renderArticle

const router = new RouterState('/article', {}, '/example')
router.asPath.toUpperCase()
// @ts-expect-error Server state has no browser navigation method.
router.push('/')
import { events } from '@healthline/next/router'
// @ts-expect-error Server imports do not provide browser events.
events.on('routeChangeComplete', () => {})
