# iOS text rendering regression checks

With Xcode installed and an iOS simulator already booted, run from the repository root:

```sh
bun run test:ios:stroke-text
```

Set `SIMULATOR_UDID` to select a device when multiple simulators are running.
The runner compiles the production UIKit label and executes it in the simulator.
It verifies all 120 update orders of text, font, spacing, line height and alignment,
style resets, and actual rendered glyph positions at phone and tablet widths.

To also check fixed comments from a DandanPlay-compatible API response at 40–50 seconds:

```sh
bun run test:ios:stroke-text -- /absolute/path/to/comment-response.json
```

The runner uses the supplied response locally; it does not fetch or bundle comments.
