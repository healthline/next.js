import next, { type BuildAssets, type LoadPage } from '@healthline/next'

const assets = {
  buildId: 'example-build',
  pages: {
    '/article': { entry: '/assets/article.js', stylesheets: [], preloads: [] },
    '/_error': { entry: '/assets/error.js', stylesheets: [], preloads: [] }
  }
} satisfies BuildAssets

export function createArticleRenderer(loadPage: LoadPage) {
  // The application's loader resolves /article, /_document and /_error.
  const app = next({ assets, loadPage })

  return async (req: { url: string }, res: unknown, slug: string, title: string) => {
    const page = await app.renderPage(req, res, '/article', { slug }, { title })
    // The application can adjust page props before rendering the document.
    const props = { ...page.props, title: page.props.title.trim() }
    return app.renderDocument({ ...page, props }, {})
  }
}
