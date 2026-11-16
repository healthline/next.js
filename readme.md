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

Installing needs private `@healthline/*` packages, so your npm account must belong to the [healthline](https://www.npmjs.com/org/healthline) npm org, with two-factor authentication on. If it doesn't yet, register at [npmjs.com](https://www.npmjs.com/) and ask a teammate with admin rights on the org to add you. Then log in and check it worked:

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
| `@healthline/next/router` | Navigation in the browser; request state on the server |
| `@healthline/next/client` | Browser startup |
| `@healthline/next/document` | Frontend's `pages/_document.js` |
| `@healthline/next/link`, `@healthline/next/page-loader` | Links, and page registration in the browser |

Each name can map to more than one file. The tool that resolves the import picks one by condition:

- **`browser`**: browser bundles (webpack and Vite) get the build in `browser/`.
- **`import`**: Node loading the package as native ESM, as the Vite server build does, gets a wrapper in `esm/`. The wrapper re-exports the CommonJS build in `node/`, so both module systems share one copy of the code.
- **`default`**: everything else (`require`, webpack's server build, Jest) gets the CommonJS build in `node/`.
- **`types`**: TypeScript gets the hand-written `.d.ts` file. It must come before the condition it describes.

To add an import: add its entry to `exports`, write its `.d.ts`, and add a wrapper in `esm/` if the module has a default export. `yarn test:pack` fails with instructions when a wrapper or a `browser` condition is missing.

## CI credentials: `NPM_TOKEN`

CI installs private `@healthline/*` packages with an npm token from the repository secret `NPM_TOKEN`. It should be a read-only token for `@healthline` packages.

If CI fails at Install Packages with `YN0035 ... Package not found (404)`, npm rejected the token: it expired, was revoked, or lost access. With `npmAuthToken ... got object`, the secret is missing or empty. Either way, someone with access to the `healthline` npm org replaces the secret with a new read-only granular token, then re-runs CI.

## Publishing to [@healthline/next](https://www.npmjs.com/package/@healthline/next)

Releases are published from a terminal. This repository is public, so no workflow here holds a token that can publish. You need:

- the setup above, with a fresh `yarn npm login`;
- publish rights on `@healthline/next` in the healthline npm org;
- rights to push tags to this repository, and the GitHub CLI logged in (`gh auth login`) for the release.

Replace `<version>` with the release's version, such as `28.0.0`:

```bash
git switch master && git pull
git status                     # should report a clean working tree
yarn install --immutable
yarn version <version> --immediate
yarn npm publish --access restricted --dry-run
yarn npm publish --access restricted
git checkout package.json      # restores package.json whether or not the publish worked
```

Once `yarn npm info @healthline/next@<version>` shows the new version, record the release:

```bash
git tag v<version> && git push origin v<version>
gh release create v<version> --title <version> --generate-notes
```

- Each `yarn npm publish` builds the package first, through the `prepack` script. The dry run then lists the files it would publish, which should match `files` in `package.json`.
- `yarn version` sets the version for this publish only. The tag records it, and `package.json` on `master` keeps the version it already had.
- npm requires a two-factor code to publish, and Yarn asks for it once the build has finished. A code passed up front with `--otp` can expire while the build runs.
- A publish that fails with `403 (Forbidden)` means your account lacks publish rights on `@healthline/next`. Ask an admin of the healthline npm org.
