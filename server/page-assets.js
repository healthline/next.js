// Collect every problem so a failed start gives the consumer one repair list.
export function checkAssets (assets) {
  const problems = []

  if (!isPlainObject(assets)) {
    throw new Error(`The assets option must be an object { buildId, pages }, got ${shown(assets)}`)
  }

  if (typeof assets.buildId !== 'string' || assets.buildId === '') {
    problems.push(`assets.buildId must be a non-empty string, got ${shown(assets.buildId)}`)
  }

  // Null-prototype, so a route lookup never finds an inherited property.
  const pages = Object.create(null)

  if (!isPlainObject(assets.pages)) {
    problems.push(`assets.pages must be an object keyed by route, got ${shown(assets.pages)}`)
  } else {
    for (const [route, page] of Object.entries(assets.pages)) {
      const field = `assets.pages[${JSON.stringify(route)}]`

      if (!route.startsWith('/') || readsAsHost(route)) {
        problems.push(`${field}: a route starts with a single "/", such as "/" or "/article"`)
      }

      if (!isPlainObject(page)) {
        problems.push(`${field} must be an object { entry, stylesheets, preloads }, got ${shown(page)}`)
        continue
      }

      if (!isUrl(page.entry)) {
        problems.push(notAUrl(`${field}.entry`, page.entry))
      }

      for (const list of ['stylesheets', 'preloads']) {
        if (!Array.isArray(page[list])) {
          problems.push(`${field}.${list} must be an array of URLs, got ${shown(page[list])}`)
          continue
        }
        page[list].forEach((url, index) => {
          if (!isUrl(url)) {
            problems.push(notAUrl(`${field}.${list}[${index}]`, url))
          }
        })
      }

      pages[route] = Object.freeze({
        entry: page.entry,
        stylesheets: Object.freeze(copyOf(page.stylesheets)),
        preloads: Object.freeze(copyOf(page.preloads))
      })
    }

    // Error responses render as the /_error route, so require it at startup.
    if (!Object.hasOwn(assets.pages, '/_error')) {
      problems.push('assets.pages["/_error"] is missing: error responses render the "/_error" route')
    }
  }

  if (problems.length) {
    throw new Error(`The assets option is invalid:\n${problems.map((problem) => `  ${problem}`).join('\n')}`)
  }

  // A copy, so the value the server renders from is the value it checked.
  return Object.freeze({ buildId: assets.buildId, pages: Object.freeze(pages) })
}

// A browser reads "//host" as a host name, and treats "\" as "/" there.
const readsAsHost = (value) => /^\/[/\\]/.test(value)

const isUrl = (value) => typeof value === 'string' && /^(https?:\/\/|\/)/.test(value) && !readsAsHost(value)

const notAUrl = (field, value) =>
  `${field} must be a URL starting with "http://", "https://" or a single "/", got ${shown(value)}` +
  (typeof value === 'string' && readsAsHost(value) ? ', which a browser reads as a host name' : '')

const isPlainObject = (value) => {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const copyOf = (list) => Array.isArray(list) ? list.slice() : []

const shown = (value) => {
  if (value === undefined) return 'nothing'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value)
  if (Array.isArray(value)) return 'an array'
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`
}
