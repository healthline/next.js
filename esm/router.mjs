import implementation from '../node/server/router.js'

export default implementation.default

// Shared modules import events on the server too. Native ESM rejects an import
// of a missing name, so this name exists here and stays undefined.
export const events = undefined
