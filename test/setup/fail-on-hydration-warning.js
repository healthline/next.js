// React 16 does not throw on a hydration mismatch. `ReactDOM.hydrate` keeps the
// server's node, patches what it can, and writes a warning to console.error, so
// a test that asserts node identity stays green over broken hydration. This
// setup file turns that warning into a failure for the whole browser project.
//
// Only the hydration family of warnings is matched. Other console.error output
// is left alone, because at least one suite reports a deliberate error through
// it (test/client-error-render.browser.test.js asserts on console.error(error)).
//
// console.error is wrapped once, in the module body, rather than per test, so a
// suite that installs its own console.error spy replaces the wrapper for its own
// duration instead of stacking wrappers on top of it. That also means such a
// suite *suspends* this guard from the moment it installs the spy until it
// restores it; a suite that does so says so and says why it is safe.
//
// Two limits a reader has to know before trusting a green run.
//
// First, React warns once per react-dom module registry, not once per mismatch:
// every hydration warning below is gated on react-dom's module-level
// `didWarnInvalidHydration` flag, which the first warning sets and nothing
// resets. So the second mismatched hydration inside one registry is silent,
// and a suite that asserts on more
// than one must call `jest.resetModules()` between them to get a fresh
// react-dom -- which is what test/client-hydration.browser.test.js does, and
// why that call is load-bearing rather than tidiness.
//
// Second, the collector is drained in afterEach and checked again in afterAll,
// never reset in beforeEach. A warning raised in a suite's `beforeAll` is
// therefore reported against that suite's first test rather than swallowed, and
// one raised in a describe's own `afterAll` still fails the file, because a
// describe's afterAll runs before this file's root-level one. The exception,
// measured: a root-level `afterAll` in the test file is registered after this
// one and so runs after the last drain. Nothing in the suite does that.

// The warnings React 16.14 emits when the client tree disagrees with the markup
// already in the container. Each is matched against the format string React
// passes as console.error's first argument; the placeholders are filled in for
// the failure message. `did not match. Server:` covers both the text-content
// difference and the prop difference.
const HYDRATION_WARNINGS = [
  'Expected server HTML to contain a matching',
  'Did not expect server HTML to contain',
  'Text content did not match',
  'did not match. Server:',
  'Extra attributes from the server:'
]

const isHydrationWarning = (first) =>
  typeof first === 'string' &&
  HYDRATION_WARNINGS.some((text) => first.includes(text))

// React's warnings arrive as a format string plus its arguments. Substituting
// them here is what makes the failure name the offending markup: "Server:
// "marker:9" Client: "marker:1"" rather than "Server: "%s" Client: "%s"".
const formatWarning = ([format, ...args]) => {
  let next = 0
  return format
    .replace(/%[so]/g, () => (next < args.length ? String(args[next++]) : '%s'))
    .concat(args.slice(next).map((arg) => ` ${String(arg)}`).join(''))
}

let seen = []

const originalConsoleError = console.error
console.error = function (...args) {
  if (isHydrationWarning(args[0])) {
    seen.push(args)
  }
  return originalConsoleError.apply(this, args)
}

const drain = (when) => {
  const warnings = seen
  seen = []

  if (warnings.length === 0) return

  throw new Error(
    `React reported a hydration mismatch ${when}:\n` +
      warnings.map(formatWarning).join('\n') +
      '\nThe rendered tree must match the markup already in the container.'
  )
}

afterEach(() => {
  drain('during this test or the hooks that set it up')
})

afterAll(() => {
  drain('after this suite\'s last test')
})
