// Consumer code that must type-check against the packed declarations, as a
// browser bundler resolves them. The pack test compiles it; it never runs.
import router, { events } from '@healthline/next/router'
import { emitter } from '@healthline/next/client'

router.push({ pathname: '/', query: { section: 'food' } }, '/', { shallow: true })
events.on('routeChangeComplete', as => as.toUpperCase())
// Applications share the emitter for their own events, with or without a payload.
events.emit('isJWFloating', true)
events.emit('haloSessionChanged')
emitter.on('after-reactdom-render', ({ appProps }) => appProps.router.url?.asPath.toUpperCase())
