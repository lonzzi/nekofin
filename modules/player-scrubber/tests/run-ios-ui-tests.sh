#!/bin/bash
set -euo pipefail

# Test real UIKit touch delivery, including a long hold followed by a drag
# above/below the original timeline hit target. Requires Xcode and CocoaPods' xcodeproj gem.
test_dir="$(cd "$(dirname "$0")" && pwd)"
test_build_dir="$(mktemp -d "${TMPDIR:-/tmp}/nekofin-scrubber-ui.XXXXXX")"
trap 'rm -rf "$test_build_dir"' EXIT

test_simulator_id="${SIMULATOR_UDID:-}"
if [[ -z "$test_simulator_id" ]]; then
  test_simulator_id="$(xcrun simctl list devices booted -j | python3 -c '
import json, sys
print(next((d["udid"] for group in json.load(sys.stdin)["devices"].values() for d in group if d["state"] == "Booted"), ""))
')"
fi
if [[ -z "$test_simulator_id" ]]; then
  echo "A booted iOS simulator is required (optionally set SIMULATOR_UDID)." >&2
  exit 1
fi
ruby "$test_dir/ui/create-project.rb" "$test_build_dir"
xcodebuild -project "$test_build_dir/ScrubberTests.xcodeproj" -scheme ScrubberTestApp \
  -destination "platform=iOS Simulator,id=$test_simulator_id" \
  -derivedDataPath "$test_build_dir/DerivedData" -quiet test
