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

## How to Test Locally

1. Build the package: `yarn build`

2. In the frontend folder: `yarn add ../next.js` (assuming the repos are siblings, otherwise use the path to your local `next.js` repo)

3. Repeat the process if you make any changes to next.js

**Having issues with the frontend reporting multiple versions of react?**

1. Rename `node_modules` (e.g. `node_modules2`)
2. Re-run `yarn add ../next.js`

Note: you'll have to change it back to `node_modules` if you want to rebuild it

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
yarn build
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

- The dry run lists the files it would publish. They should match `files` in `package.json`.
- `yarn version` sets the version for this publish only. The tag records it, and `package.json` on `master` keeps the version it already had.
- npm requires a two-factor code to publish. Add `--otp <code>` if Yarn doesn't prompt for it.
- A publish that fails with `403 (Forbidden)` means your account lacks publish rights on `@healthline/next`. Ask an admin of the healthline npm org.
