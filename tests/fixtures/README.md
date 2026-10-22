# tests/fixtures/

- `manifest.json` — `admin.manifest.json` from `lib-crud-py`'s manifest
  conformance fixtures (`tests/fixtures/manifest/`, `integration/templates-sdks-ui`
  at 1e0ad2d): heroes v1/v2 and quests v1. Replace it by copying the file again
  when the manifest changes.
- `stub.ts` — `createStubClient`: a real `@craftainer/crud-sdk` client over a
  fake `fetch` that serves the catalog, the manifest and in-memory records.
  Shared by the unit tests and by Storybook (`.storybook/`, stories), so both
  exercise the SDK, not a mock of it.
