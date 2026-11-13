import router, { events } from '@healthline/next/router'
import { emitter } from '@healthline/next/client'
router.push({ pathname: '/', query: { section: 'food' } }, '/', { shallow: true })
events.on('routeChangeComplete', as => as.toUpperCase())
// @ts-expect-error Route changes send the displayed URL as a string.
events.emit('routeChangeComplete', 42)
// @ts-expect-error A route event handler receives the displayed URL.
events.on('routeChangeStart', (as: number) => as)
// Applications share the emitter for their own events, with or without a payload.
const onFloating = (floating: boolean) => floating
events.on('isJWFloating', onFloating)
events.emit('isJWFloating', true)
events.emit('haloSessionChanged')
events.off('isJWFloating', onFloating)
const eventName: string = 'pathnameChanged'
events.emit(eventName, '/next')
emitter.on('after-reactdom-render', ({ appProps }) => appProps.router.url?.asPath.toUpperCase())
// @ts-expect-error The browser singleton is not a constructor.
new router('/', {}, '/')
