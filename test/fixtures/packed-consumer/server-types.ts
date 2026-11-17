// Consumer code that must type-check against the packed declarations, as Node
// and the server build resolve them. The pack test compiles it; it never runs.
// A line under `@ts-expect-error` is misuse the declarations must reject.
import { createElement } from 'react'
import next, { doDocRender, doPageRender } from '@healthline/next'
import Document, { Head, Main, NextScript } from '@healthline/next/document'
import { registerPage } from '@healthline/next/page-loader'
import router, { events } from '@healthline/next/router'

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

const Article = ({ title }: { title: string }) => createElement('h1', null, title)
registerPage('/article', () => ({ page: Article }))
const app = next({ dir: '.', loadPage: async id => id === '/_document' ? ArticleDocument : Article })
async function renderArticle () {
  const request = { url: '/health/sleep' }
  const page = await app.renderPage(request, {}, '/article', { slug: 'sleep' }, { title: 'Sleep' })
  page.query.slug.toUpperCase()
  page.props.title.toUpperCase()
  const legacyPage = await doPageRender(request, {}, '/article', {}, { title: 'Sleep' }, app.renderOpts)
  await doDocRender(legacyPage, {}, app.renderOpts)
  // @ts-expect-error The query's slug is inferred as a string.
  page.query.slug.toFixed()
  // @ts-expect-error The initial title prop is inferred as a string.
  page.props.title.toFixed()
  const processedPage = { ...page, html: (page.html || page.errorHtml || '').toUpperCase() }
  await app.renderDocument(processedPage, { config: {} })
  // @ts-expect-error Request options cannot replace the app's build assets.
  app.renderPage(request, {}, '/article', {}, {}, { assets: { buildId: 'request', pages: {} } })
}
void renderArticle

// Code that also runs in the browser gets the same router types here.
router.route?.toUpperCase()
events.on('routeChangeComplete', as => as.toUpperCase())
