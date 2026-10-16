#!/bin/bash
set -euo pipefail

# Run the production UIKit renderer directly in an already booted simulator.
# Optional argument: a live DandanPlay comment response for the 40–50s sample.
test_dir="$(cd "$(dirname "$0")" && pwd)"
test_build_dir="$(mktemp -d "${TMPDIR:-/tmp}/nekofin-stroke-text.XXXXXX")"
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
  "$test_dir/../ios/StrokeTextInternalView.swift" \
  "$test_dir/StrokeTextTests.swift" \
  -o "$test_build_dir/StrokeTextTests"
xcrun simctl spawn "$test_simulator_id" "$test_build_dir/StrokeTextTests" "$@"
