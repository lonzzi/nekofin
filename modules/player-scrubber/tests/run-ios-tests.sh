#!/bin/bash
set -euo pipefail

# Exercise the production UIKit scrubber directly in a booted simulator.
test_dir="$(cd "$(dirname "$0")" && pwd)"
test_build_dir="$(mktemp -d "${TMPDIR:-/tmp}/nekofin-player-scrubber.XXXXXX")"
trap 'rm -rf "$test_build_dir"' EXIT

test_simulator_id="${SIMULATOR_UDID:-}"
if [[ -z "$test_simulator_id" ]]; then
  test_simulator_id="$(xcrun simctl list devices booted -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
print(next((d["udid"] for group in devices.values() for d in group if d["state"] == "Booted"), ""))
')"
fi
if [[ -z "$test_simulator_id" ]]; then
  echo "A booted iOS simulator is required (optionally set SIMULATOR_UDID)." >&2
  exit 1
fi

test_arch="$(uname -m)"
xcrun --sdk iphonesimulator swiftc \
  -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -target "$test_arch-apple-ios16.4-simulator" \
  "$test_dir/../ios/MediaScrubberSlider.swift" \
  "$test_dir/MediaScrubberTests.swift" \
  -o "$test_build_dir/MediaScrubberTests"
xcrun simctl spawn "$test_simulator_id" "$test_build_dir/MediaScrubberTests" "$@"
