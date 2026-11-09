# HLM's fork of Next.js

Minimialist version of Next.js. Not intended for external consumption.

[Base Documentation](https://github.com/healthline/next.js/tree/fork-base#how-to-use)

## Setup

### Install Yarn via Corepack

This project uses Yarn 4 managed via corepack. To set up:

```bash
corepack enable
corepack prepare yarn@4.12.0 --activate
```

### NPM Private Repo Access

If you need access to private `@healthline/*` packages, login to npm with your scope:

```bash
yarn npm login --scope healthline
```

This creates `~/.yarnrc.yml` with your auth token.

## How to Test Locally

1. Build the package: `yarn build`

2. In the frontend folder: `yarn add ../next.js` (assuming the repos are siblings, otherwise use the path to your local `next.js` repo)

3. Repeat the process if you make any changes to next.js

**Having issues with the frontend reporting multiple versions of react?**

1. Rename `node_modules` (e.g. `node_modules2`)
2. Re-run `yarn add ../next.js`

Note: you'll have to change it back to `node_modules` if you want to rebuild it

## Serving pages built by Vite

A site can build some or all of its pages with Vite instead of webpack. The server serves those pages from Vite's own manifest. Every other page renders from webpack's entrypoints, as before.

This package supports React 16 (`^16.14.0`) only. Supporting React 18 needs a `hydrateRoot`/`createRoot` path and a new major release. The Vite plugin that generates page entries and writes the manifest file lives in frontend (`scripts/vite-plugins/healthline-next.js`), not in this package.

The consumer's build writes one file per site:

```
.next/vite-manifests/<BUILD_ID>-<site>.json
{ "outDir": "<Vite's build.outDir, relative to .next/bundles>",
  "manifest": <Vite's .vite/manifest.json, unchanged> }
```

- **Which file is read.** In production the server reads the file for the current `BUILD_ID` and `SITE`. If there is no file, the site has no Vite pages and nothing changes. The server refuses to start unless the file is JSON holding an object `manifest` and a string `outDir` that is relative and has no `..` segment. It also refuses a chunk that is not an object with a string `file`, a `css` or `imports` that is not a list of strings, or an `imports` entry that is not a key in `manifest`, and names the file, the chunk and the key.
- **Which pages it covers.** A page renders from Vite when the manifest has an entry chunk whose `name` is `pages/<route>`, such as `pages/home-page` for `pages/home-page.js`. A page with no matching entry renders from webpack. The server does not warn when that happens; checking that every page sent to Vite has an entry is the consumer's build's job.
- **What the page gets.** Such a page gets the tags Vite's backend-integration guide describes. Those are a stylesheet link for each CSS file of the entry and of its static imports, a `modulepreload` for each static import, and one `<script type="module">` for the entry. Every URL is `publicPath` + `outDir` + the manifest's file name.
- **Turning it off or requiring it.** `next({ vite })` takes `true`, `false` or nothing. Left out, the server reads the file if it exists, as above. With `false` it never reads the file, so every page renders from webpack. With `true` the server refuses to start when the file is missing, and names the path it expected. Any other value is a `TypeError`. In development the server reads no manifest, whatever the option says.

The browser entry and the page loader run unchanged in a Vite bundle. Their two webpack-only names, `__webpack_public_path__` and `module.hot`, are read behind `typeof` checks. webpack folds those checks to constants, so a webpack build behaves as before.

## Publishing to [@healthline/next](https://www.npmjs.com/package/@healthline/next)

### Steps to Publish:

1. **Access Permissions**: Ensure you have the rights to publish to `@healthline/next` on npm and push tags to the repository.

2. **Create Release Tag** (using [Semantic Versioning](https://semver.org/)):

   ```bash
   yarn release:tag
   ```

   This script will:
   - Prompt you to select a release type (Major, Minor, or Patch)
   - Create a new version tag based on the last tag
   - Push the tag to trigger the GitHub Actions publish workflow

3. **Verify the Release**:

   - Check the [publish workflow](https://github.com/healthline/next.js/actions/workflows/publish.yml) to ensure it completed successfully
   - Verify the [GitHub release](https://github.com/healthline/next.js/releases) was created
   - Confirm the package was published on the [npm page](https://www.npmjs.com/package/@healthline/next?activeTab=versions)

The GitHub Actions workflow will automatically:
- Build the project
- Set the package version from the tag
- Publish to npm
- Create a GitHub release with auto-generated release notes
