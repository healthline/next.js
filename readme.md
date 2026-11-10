# HLM's fork of Next.js

Minimialist version of Next.js. Not intended for external consumption.

[Base Documentation](https://github.com/healthline/next.js/tree/fork-base#how-to-use)

## Setup

### Install Node

`.nvmrc` sets the Node version: `nvm install` or `fnm use` reads it, and so do the GitHub Actions workflows.

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

## Publishing to [@healthline/next](https://www.npmjs.com/package/@healthline/next)

### Steps to Publish:

1. **Access Permissions**: Ensure you have the rights to push tags to the repository. The publish run then waits in the Actions UI for a reviewer of the `publishing` environment, other than whoever pushed the tag, to approve it.

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

### Credentials: `NPM_TOKEN`

Both workflows read an npm token from a secret named `NPM_TOKEN`.

- **The repository secret**, used by CI, should be a read-only token for `@healthline` packages.
- **The `publishing` environment's secret** must be a separate token that can publish `@healthline/next`. It overrides the repository secret, so CI never holds the publish token; without it, the publish step fails.

If Install Packages fails with `YN0035 ... Package not found (404)` or `npmAuthToken ... got object`, the token has expired or the secret is missing. Replace that secret with a new granular token of the same scope, then re-run.
