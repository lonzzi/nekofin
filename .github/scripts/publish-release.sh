#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_TAG:?RELEASE_TAG must be set}"
: "${PRERELEASE:?PRERELEASE must be set}"

case "$PRERELEASE" in
  true) latest=false ;;
  false) latest=true ;;
  *) echo 'PRERELEASE must be true or false' >&2; exit 1 ;;
esac

assets=(
  "release/nekofin-${RELEASE_TAG}-android-arm64.apk"
  "release/nekofin-${RELEASE_TAG}-ios-unsigned.ipa"
  'release/SHA256SUMS'
)
# Runtime contracts are produced by the Release workflow for OTA-capable builds.
runtime_contract="release/nekofin-${RELEASE_TAG}-runtimes.json"
if [[ -s "$runtime_contract" ]]; then
  assets+=("$runtime_contract")
fi
source_metadata="release/nekofin-${RELEASE_TAG}-ios-source.json"
if [[ -s "$source_metadata" ]]; then
  assets+=("$source_metadata")
fi
for asset in "${assets[@]}"; do
  if [[ ! -s "$asset" ]]; then
    echo "Missing or empty release asset: $asset" >&2
    exit 1
  fi
done

if draft=$(gh release view "$RELEASE_TAG" --json isDraft --jq '.isDraft'); then
  if [[ "$draft" != 'true' ]]; then
    echo "Release $RELEASE_TAG is already published; keeping its assets unchanged."
    exit 0
  fi
else
  gh release create "$RELEASE_TAG" \
    --verify-tag \
    --draft \
    --prerelease="$PRERELEASE" \
    --title "$RELEASE_TAG" \
    --generate-notes \
    --notes 'Downloads: Android arm64 APK and unsigned iOS IPA (requires sideload signing). SHA256SUMS contains file checksums.'
fi

# Only replace assets while the release is a draft, so a failed upload can be retried.
gh release upload "$RELEASE_TAG" "${assets[@]}" --clobber
gh release edit "$RELEASE_TAG" --draft=false --prerelease="$PRERELEASE" --latest="$latest"
