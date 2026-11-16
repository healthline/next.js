import implementation from '../node/server/router.js'

export default implementation.default

// Frontend code that runs on both server and browser imports `events`. Native
// ESM rejects an import of a missing name, so the name exists here, undefined.
export const events = undefined
