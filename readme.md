# HLM's fork of Next.js

We publish this internal fork as `@healthline/next`.

## Setup

Run these commands from the repository root. `nvm install` uses the Node version in [`.nvmrc`](.nvmrc). Corepack uses the Yarn version pinned in [`package.json`](package.json).

```bash
nvm install
corepack enable
yarn --version
```

Your npm account needs read access to the [healthline npm organization](https://www.npmjs.com/org/healthline). Sign in and confirm Yarn prints your npm username before installing.

```bash
yarn npm login --scope healthline --web-login
yarn npm whoami --scope healthline
yarn install --immutable
```

If a private package returns a 404, repeat `yarn npm whoami --scope healthline`. Sign in again if the session expired. If it prints the right username and the install still fails, check your organization access.

## Check the package

```bash
yarn build && yarn lint && yarn test --ci && yarn test:pack --ci
```

Run the pack suite last because packing rebuilds the output and temporarily rewrites `package.json`. To try the actual release artifact in frontend, run `yarn pack --out /tmp/healthline-next.tgz` here, then `yarn add @healthline/next@file:/tmp/healthline-next.tgz` in a disposable frontend worktree.

## Public imports

Use the public names below. The [export map](package.json) defines which package paths callers can import. Upgrade frontend and migrate any private imports together.

| Entry | Purpose |
| --- | --- |
| `@healthline/next` | Server construction |
| `@healthline/next/babel` | Babel preset; also supports legacy `next/*` aliases |
| `@healthline/next/router` | Browser navigation singleton, or request router-state class in Node |
| `@healthline/next/client` | Browser startup |
| `@healthline/next/document` | Server Document |
| `@healthline/next/link`, `head`, `page-loader` | Shared entries |

Router events and navigation are browser APIs. For browser TypeScript code, use `moduleResolution: "bundler"` with `customConditions: ["browser"]`. Node resolves the server router.

## Releases

Follow the [publishing runbook](docs/publishing.md) to publish to npm and record the GitHub release.
