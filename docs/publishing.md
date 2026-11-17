# Publish @healthline/next

Publish from a terminal after the release changes merge to `master`. Follow the [repository setup](../readme.md#setup), renew your npm login, and confirm you have permission to publish to the healthline npm organization and push Git tags. Sign in to GitHub CLI to create the release.

## Pick the version

Look up the latest published version. `package.json` on `master` doesn't show it: step 1 sets the version only for the publish, and step 3 restores the file.

```bash
yarn npm info @healthline/next --fields version
```

Then pick the smallest bump that covers everything merged since that release. Frontend is the only consumer, so judge each change by what frontend has to do to upgrade. The public surface is the import paths in the `exports` map of the [package manifest](../package.json) and the options and methods frontend calls on them.

| To upgrade, frontend… | Bump | For example |
| --- | --- | --- |
| must change its own code | Major: `28.1.0` to `29.0.0` | A public import path, export or option is removed or renamed, or a render method returns a different result. |
| changes nothing, and can use something new | Minor: `28.1.0` to `28.2.0` | A new import path such as `@healthline/next/router`, or a new option. |
| changes nothing, and gets a fix | Patch: `28.1.0` to `28.1.1` | A bug fix behind the same imports and options. |

If a change fits two rows, use the larger bump. [Frontend's dependency range](https://github.com/healthline/frontend/blob/main/package.json) starts with `~`, which accepts new patch versions, so a breaking change released as a patch can arrive in a lockfile update that nobody reviews as an upgrade. A minor or major reaches frontend only when someone raises that range in a frontend PR.

## 1. Check the archive and registry

Start in a clean release worktree. Replace `28.1.0` with the version you picked. Run all three steps in this checkout and the same terminal session: steps 2 and 3 reuse `release_version` and stop if it is unset.

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
: "${release_version:?Set release_version as in step 1}" &&
yarn npm publish --access restricted
```

Enter the one-time password when Yarn prompts after the build. If publish returns 403, ask a healthline npm organization admin to check your publish rights.

After Yarn reports that the archive was published, look up the version.

```bash
: "${release_version:?Set release_version as in step 1}" &&
yarn npm info "@healthline/next@$release_version" --fields version
```

Continue when the returned version exactly matches `release_version`. Yarn can return the latest version when the requested one is absent.

## 3. Record the release

Restore the temporary version bump, then tag the source commit you published.

```bash
: "${release_version:?Set release_version as in step 1}" &&
git restore -- package.json &&
git tag "v$release_version" &&
git push origin "refs/tags/v$release_version" &&
gh release create "v$release_version" --verify-tag --title "$release_version" --generate-notes
```

If you stop before publishing, restore the temporary bump with `git restore -- package.json`.

## CI install failures

The [CI workflow](../.github/workflows/ci.yml) passes `NPM_TOKEN` to the [setup action](../.github/actions/env-setup/action.yml). If CI cannot install a private package, check that the secret is set and that the token still has read access. Use a read-only token for CI.
