import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateNativeTag } from './validate-tag.mjs';

test('requires matching native version when publishing code but allows rollback to older installed binaries', () => {
  assert.throws(() => validateNativeTag('v0.1.0-beta.1', 'update', '0.2.0'), /requires/);
  assert.equal(validateNativeTag('v0.1.0-beta.1', 'rollback', '0.2.0'), 'v0.1.0-beta.1');
});

test('rejects malformed native tags for every operation before passing them to gh', () => {
  for (const operation of ['update', 'rollback']) {
    for (const tag of ['--repo=other/repository', 'nightly', 'vv0.1.0', 'v0.1.0\n']) {
      assert.throws(() => validateNativeTag(tag, operation, '0.1.0'));
    }
  }
});
