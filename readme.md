# HLM's fork of Next.js

Minimialist version of Next.js. Not intended for external consumption.

[Base Documentation](https://github.com/healthline/next.js/tree/fork-base#how-to-use)

## Setup

### Install Node

`.nvmrc` sets the Node version, and `nvm install` installs and switches to it.

### Install Yarn via Corepack

This project uses Yarn 4 managed via corepack. To set up:

```bash
corepack enable
corepack prepare yarn@4.12.0 --activate
```

### NPM Private Repo Access

This package is published to npm as [`@healthline/next`](https://www.npmjs.com/package/@healthline/next). Installing needs private `@healthline/*` packages, so your npm account must belong to the [healthline](https://www.npmjs.com/org/healthline) npm org, with two-factor authentication on. If it doesn't yet, register at [npmjs.com](https://www.npmjs.com/) and ask a teammate with admin rights on the org to add you. Then log in and check it worked:

```bash
yarn npm login --scope healthline --web-login
yarn npm whoami --scope healthline     # prints your npm username
```

The login saves a token in `~/.yarnrc.yml`. npm [expires login sessions after two hours](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/), so log in again when an install fails with `YN0035 ... Package not found (404)`.

### Install dependencies

```bash
yarn install
```

## Check the package

Run the same checks as CI, in order:

```bash
yarn build && yarn lint && yarn test --ci && yarn test:pack --ci
```

Build first because the dependency checks inspect generated `node/` and `browser/` files. Run the archive tests last: `yarn test:pack` rebuilds the package and temporarily rewrites `package.json`, which the other tests read.

Packing builds fresh output and uses `pinst` to disable the contributor-only install hook in the archive, then restores it in the checkout. The archive tests check required files, the absence of consumer install hooks and restoration of the working manifest. They do not replace testing the package in frontend.

## How to test in frontend

Frontend can import only what the packed archive exports, so test the archive, not this folder:

1. Here: `yarn pack --out /tmp/healthline-next.tgz`
2. In a disposable frontend worktree: `yarn add @healthline/next@file:/tmp/healthline-next.tgz`
3. Repeat both steps after each change here.

## Public imports

Frontend imports the package only by these names. `exports` in [`package.json`](package.json) maps each name to a file, and any other path fails to resolve.

| Import | Who uses it |
| --- | --- |
| `@healthline/next` | Frontend's server: create the app, render pages |
| `@healthline/next/babel` | Frontend's Babel config |
| `@healthline/next/router` | Navigation and route events in the browser. The server build has the same exports: its events do nothing and navigation throws |
| `@healthline/next/client` | Browser startup |
| `@healthline/next/document` | Frontend's `pages/_document.js` |
| `@healthline/next/page-loader` | Page registration in the browser |

Each name can map to more than one file. The tool that resolves the import picks one by condition:

- **`browser`**: browser bundles (webpack and Vite) get the build in `browser/`.
- **`import`**: Node loading the package as native ESM, as the Vite server build does, gets a wrapper in `esm/`. The wrapper re-exports the CommonJS build in `node/`, so both module systems share one copy of the code.
- **`default`**: everything else (`require`, webpack's server build, Jest) gets the CommonJS build in `node/`.
- **`types`**: TypeScript gets the hand-written `.d.ts` file. It must come before the condition it describes.

To add an import: add its entry to `exports`, write its `.d.ts`, and add a wrapper in `esm/` if the module has a default export. `yarn test:pack` fails with instructions when a wrapper or a `browser` condition is missing.

## Rendering

Frontend owns how a site is built; this package owns how a page renders. Anything that reads build output, such as a bundler plugin or a manifest reader, belongs in frontend: frontend turns its build into each route's script, stylesheets and preloads, passes them as `assets`, and passes a `loadPage` function that returns each page's component. This package renders from those values and never reads a consumer's build output. [The bundler-neutral test](test/bundler-neutral-source.test.js) fails if the shipped code uses `import.meta`, names a `vite` path or reads a `manifest.json`. The webpack path, which reads `.next/` itself, is the one exception, and it goes when every site passes `assets`. Frontend's ADR `docs/adr/2026-11-10-frontend-owns-build-healthline-next-owns-rendering.md` records the decision and the alternatives it rejected.

Start with the [typed rendering example](examples/render-article.ts). It shows how to supply assets and a page loader, render a page, and process the result before rendering its document. The pack suite checks this example against the declarations in the archive. See [the public types](index.d.ts) for option and fallback rules.

## Releases

To publish to npm and record the GitHub release, follow the [publishing runbook](docs/publishing.md). It also covers [CI install failures](docs/publishing.md#ci-install-failures).
