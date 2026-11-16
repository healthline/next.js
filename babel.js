const createPreset = require('@healthline/six-million/babel').default

module.exports = (context, opts = {}) => createPreset(context, { ...opts })
