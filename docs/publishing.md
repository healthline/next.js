# Publish @healthline/next

Publish from a terminal after the release changes merge to `master`. Follow the [repository setup](../readme.md#setup), renew your npm login, and confirm you have permission to publish to the healthline npm organization and push Git tags. Sign in to GitHub CLI to create the release.

## 1. Check the archive and registry

Start in a clean release worktree. Replace `28.1.0` with the version you're releasing. Run all three steps in this checkout.

```bash
release_version=28.1.0
test -z "$(git status --porcelain)" &&
git fetch origin master &&
git switch --detach origin/master &&
yarn install --immutable &&
yarn version "$release_version" --immediate &&
yarn npm publish --access restricted --dry-run
```

Continue when the dry run lists the expected files and says `Package would be published to https://registry.npmjs.org`. The [package manifest](../package.json) sets the publish registry and controls which files ship.

## 2. Publish and verify the version

```bash
yarn npm publish --access restricted
```

Enter the one-time password when Yarn prompts after the build. If publish returns 403, ask a healthline npm organization admin to check your publish rights.

After Yarn reports that the archive was published, look up the version.

```bash
yarn npm info "@healthline/next@$release_version" --fields version
```

Continue when the returned version exactly matches `release_version`. Yarn can return the latest version when the requested one is absent.

## 3. Record the release

Restore the temporary version bump, then tag the source commit you published.

```bash
git restore -- package.json &&
git tag "v$release_version" &&
git push origin "refs/tags/v$release_version" &&
gh release create "v$release_version" --verify-tag --title "$release_version" --generate-notes
```

If you stop before publishing, restore the temporary bump with `git restore -- package.json`.

## CI install failures

The [CI workflow](../.github/workflows/ci.yml) passes `NPM_TOKEN` to the [setup action](../.github/actions/env-setup/action.yml). If CI cannot install a private package, check that the secret is set and that the token still has read access. Use a read-only token for CI.
