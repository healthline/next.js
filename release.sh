#!/bin/bash
set -e
set -o pipefail
trap 'echo -e "\n\033[1;31mError on line $LINENO: \"$BASH_COMMAND\" exited with status $?\033[0m" >&2; exit 1' ERR

# Function to create a new release tag
createYourNewTag() {
    # Function to handle major version bump
    handle_major() {
    IFS='.' read -r major minor patch <<< "${LAST_TAG#v}"
    YOUR_NEW_TAG="$((major + 1)).0.0"
    echo -e "\033[32mNew release tag will be: v${YOUR_NEW_TAG}\033[0m"
    }

    # Function to handle minor version bump  
    handle_minor() {
    IFS='.' read -r major minor patch <<< "${LAST_TAG#v}"
    YOUR_NEW_TAG="${major}.$((minor + 1)).0"
    echo -e "\033[32mNew release tag will be: v${YOUR_NEW_TAG}\033[0m"
    }

    # Function to handle patch version bump
    handle_patch() {
    IFS='.' read -r major minor patch <<< "${LAST_TAG#v}"
    YOUR_NEW_TAG="${major}.${minor}.$((patch + 1))"
    echo -e "\033[32mNew release tag will be: v${YOUR_NEW_TAG}\033[0m"
    }

    # Show dialog and handle response
    response=$(osascript \
    -e 'tell application "System Events"' \
    -e 'activate' \
    -e 'try' \
    -e 'set theChoice to choose from list {"Major", "Minor", "Patch"} with prompt "Select the release type:" with title "Release Type" default items {"Patch"}' \
    -e 'if theChoice is false then' \
    -e 'return "Cancel"' \
    -e 'else' \
    -e 'return item 1 of theChoice' \
    -e 'end if' \
    -e 'on error errMsg number errNum' \
    -e 'return "Cancel"' \
    -e 'end try' \
    -e 'end tell'
    )

    case $response in
    "Major") handle_major ;;
    "Minor") handle_minor ;;
    "Patch") handle_patch ;;
    "Cancel") exit 0 ;;
    esac
}

# Prints out instructions for verifying the release
verifyTag() {
    echo
    echo -e "\033[1;33mVerify that the publish workflow fired here:\033[0m https://github.com/healthline/next.js/actions/workflows/publish.yml"
    echo -e "\033[1;33mVerify release notes here:\033[0m https://github.com/healthline/next.js/releases"
    echo -e "\033[1;33mVerify the package on npm:\033[0m https://www.npmjs.com/package/@healthline/next?activeTab=versions"
    echo
}

# Got script from here https://gist.github.com/rponte/fdc0724dd984088606b0?permalink_comment_id=3266206#gistcomment-3266206
git fetch --tags
LAST_TAG=$(git tag --list | grep "^v" | sort -V | tail -1)
YOUR_NEW_TAG=""


git checkout master
git pull
createYourNewTag
git tag "v${YOUR_NEW_TAG}"
git push origin "v${YOUR_NEW_TAG}"
verifyTag
