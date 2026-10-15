# Agent Instructions

All commits must follow the Conventional Commits format enforced by `@commitlint/config-conventional`.

Examples:

- `fix: stabilize settings sheet presentation`
- `refactor: introduce media adapter harness`
- `test: add query key contract coverage`
- `docs: document test harness architecture`

Before committing behavior changes, run the relevant local regression commands and mention any command that could not be run.

## UI components

Prefer each platform's native components and interactions throughout this project. Use iOS and Android system controls through the appropriate React Native or Expo APIs instead of recreating their appearance with custom views. In particular, use native alerts, menus, pickers, and sheets when they meet the requirement. Only use custom components when native capabilities cannot provide the required behavior or the user explicitly requests a custom design.
