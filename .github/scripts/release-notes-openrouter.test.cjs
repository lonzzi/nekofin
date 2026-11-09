const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  BATCH_SIZE,
  MODEL,
  FALLBACK_MODEL,
  generateBilingualEntries,
} = require('./release-notes-openrouter.cjs');

const apiKey = 'test-openrouter-key-do-not-log';
const commits = ['a', 'b'].map((letter) => ({
  sha: letter.repeat(40),
  subject: `fix: playback ${letter}`,
  body: 'Player lifecycle details',
  changed_files: ['components/player/index.tsx'],
  diff_excerpt: 'diff: hide overlays while exiting the player',
}));
const context = {
  tag: 'v0.2.0-beta.1',
  previous: 'v0.2.0-beta.0',
  project_context: 'NekoFin is a mobile media player.',
  commits,
};

function catalog(overrides = {}, id = MODEL) {
  return {
    data: [
      {
        id,
        pricing: { prompt: '0', completion: '0', request: '0' },
        architecture: { output_modalities: ['text'] },
        supported_parameters: ['response_format', 'reasoning'],
        ...overrides,
      },
    ],
  };
}

const routerCatalog = catalog({}, FALLBACK_MODEL);
const bothModels = { data: [...catalog().data, ...routerCatalog.data] };

function generated(source = commits) {
  return source.map((commit) => ({
    sha: commit.sha,
    zh: '修复退出播放器时的界面显示问题。',
    en: 'Fix overlays when leaving the player.',
  }));
}

function response(entries = generated()) {
  return {
    model: MODEL,
    choices: [
      { finish_reason: 'stop', message: { content: JSON.stringify({ changes: entries }) } },
    ],
    usage: { cost: 0 },
  };
}

function harness({ model = catalog(), completion = response(), inference } = {}) {
  const calls = [];
  const waits = [];
  const logs = [];
  const options = {
    apiKey,
    sleep: async (ms) => waits.push(ms),
    log: (text) => logs.push(text),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/models')) return Response.json(model);
      return inference ? inference(init) : Response.json(completion);
    },
  };
  return { options, calls, waits, logs };
}

function requestedModels(calls) {
  return calls.slice(1).map((call) => JSON.parse(call.init.body).model);
}

test('prefers Dots and requires zero-priced providers with JSON support', async () => {
  const { options, calls, logs } = harness({ model: bothModels });
  assert.deepEqual(await generateBilingualEntries(context, options), generated());
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/models');
  assert.equal(calls[0].init.headers, undefined);
  assert.equal(calls[1].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(calls[1].init.headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(calls[1].init.redirect, 'error');
  assert.ok(calls[1].init.signal instanceof AbortSignal);
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.model, MODEL);
  assert.equal(body.models, undefined);
  assert.deepEqual(body.reasoning, { effort: 'none', exclude: true });
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.deepEqual(body.provider, {
    require_parameters: true,
    max_price: { prompt: 0, completion: 0, request: 0 },
  });
  assert.equal(body.max_tokens, 8_192);
  assert.deepEqual(JSON.parse(body.messages[1].content), context);
  assert.ok(!calls[1].init.body.includes(apiKey));
  assert.ok(logs.some((line) => line.includes('USD 0')));
  assert.ok(logs.every((line) => !line.includes(apiKey)));
});

for (const [name, model] of [
  ['missing model', { data: [] }],
  ['malformed catalog', { data: {} }],
  ['paid prompt', catalog({ pricing: { prompt: '0.01', completion: '0' } })],
  ['paid completion', catalog({ pricing: { prompt: '0', completion: '0.01' } })],
  ['request fee', catalog({ pricing: { prompt: '0', completion: '0', request: '0.01' } })],
  ['missing price', catalog({ pricing: { prompt: null, completion: '0' } })],
  ['missing output support', catalog({ supported_parameters: [] })],
]) {
  test(`refuses inference when the live catalog has ${name}`, async () => {
    const { options, calls } = harness({ model });
    await assert.rejects(generateBilingualEntries(context, options), /No eligible free/);
    assert.equal(calls.length, 1);
  });
}

test('uses the live free router when Dots disappears or its price changes', async () => {
  const paidDots = catalog({ pricing: { prompt: '1', completion: '0' } });
  for (const model of [routerCatalog, { data: [...paidDots.data, ...routerCatalog.data] }]) {
    const { options, calls, logs } = harness({ model });
    assert.deepEqual(await generateBilingualEntries(context, options), generated());
    assert.deepEqual(requestedModels(calls), [FALLBACK_MODEL]);
    assert.ok(logs.some((line) => line.includes(`Using ${FALLBACK_MODEL}`)));
  }
});

test('switches to the free router after a Dots rate limit and bounds retries', async () => {
  const { options, calls, waits, logs } = harness({
    model: bothModels,
    inference: () => new Response(apiKey, { status: 429, headers: { 'Retry-After': '2' } }),
  });
  await assert.rejects(generateBilingualEntries(context, options), /HTTP 429/);
  assert.deepEqual(requestedModels(calls), [MODEL, FALLBACK_MODEL, FALLBACK_MODEL]);
  assert.deepEqual(waits, [2_000]);
  assert.ok(logs.every((line) => !line.includes(apiKey)));
  for (const call of calls.slice(1)) {
    assert.deepEqual(JSON.parse(call.init.body).provider.max_price, {
      prompt: 0,
      completion: 0,
      request: 0,
    });
  }
});

test('rejects an ineligible router even when Dots fails', async () => {
  const paidRouter = catalog(
    { pricing: { prompt: '0', completion: '0', request: '1' } },
    FALLBACK_MODEL,
  );
  const { options, calls } = harness({
    model: { data: [...catalog().data, ...paidRouter.data] },
    inference: () => new Response(null, { status: 404 }),
  });
  await assert.rejects(generateBilingualEntries(context, options), /HTTP 404/);
  assert.deepEqual(requestedModels(calls), [MODEL]);
});

test('requires a key only when there are entries to generate', async () => {
  const { options, calls } = harness();
  options.apiKey = '';
  assert.deepEqual(await generateBilingualEntries({ commits: [] }, options), []);
  await assert.rejects(generateBilingualEntries(context, options), /OPENROUTER_API_KEY/);
  assert.deepEqual(calls, []);
});

test('retries upstream rate limits without switching models or logging provider error bodies', async () => {
  let attempts = 0;
  const { options, calls, waits, logs } = harness({
    inference: () => {
      attempts += 1;
      return attempts === 1
        ? new Response(apiKey, { status: 429, headers: { 'Retry-After': '2' } })
        : Response.json(response());
    },
  });
  assert.deepEqual(await generateBilingualEntries(context, options), generated());
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [2_000]);
  for (const call of calls.slice(1)) assert.equal(JSON.parse(call.init.body).model, MODEL);
  assert.ok(logs.every((line) => !line.includes(apiKey)));
});

test('bounds retries and keeps authorization/network error details out of errors', async () => {
  const unavailable = harness({ inference: () => new Response(apiKey, { status: 503 }) });
  await assert.rejects(generateBilingualEntries(context, unavailable.options), (error) => {
    assert.match(error.message, /HTTP 503/);
    return !error.message.includes(apiKey);
  });
  assert.equal(unavailable.calls.length, 4);
  assert.equal(unavailable.waits.length, 2);
  for (const status of [401, 402, 403]) {
    const rejected = harness({
      model: bothModels,
      inference: () => new Response(apiKey, { status }),
    });
    await assert.rejects(
      generateBilingualEntries(context, rejected.options),
      new RegExp(`HTTP ${status}`),
    );
    assert.deepEqual(requestedModels(rejected.calls), [MODEL]);
  }
  const network = harness();
  network.options.fetchImpl = async () => {
    throw new Error(apiKey);
  };
  await assert.rejects(generateBilingualEntries(context, network.options), (error) => {
    assert.match(error.message, /network request failed/);
    return !error.message.includes(apiKey);
  });
  assert.equal(network.waits.length, 2);
});

for (const [name, change, expected] of [
  ['missing entries', [], /Incomplete/],
  ['reordered entries', generated().reverse(), /identity mismatch/],
  ['duplicate entries', [generated()[0], generated()[0]], /identity mismatch/],
  [
    'invalid Chinese',
    [{ ...generated()[0], zh: 'English only' }, generated()[1]],
    /Chinese and English/,
  ],
  [
    'invalid English',
    [{ ...generated()[0], en: '仍然是中文' }, generated()[1]],
    /Chinese and English/,
  ],
  ['wrong type', [{ ...generated()[0], zh: 42 }, generated()[1]], /Chinese and English/],
  [
    'excessive length',
    [{ ...generated()[0], zh: '中'.repeat(71) }, generated()[1]],
    /excessively long/,
  ],
]) {
  test(`rejects ${name} before notes can be published`, async () => {
    const { options } = harness({ completion: response(change) });
    await assert.rejects(generateBilingualEntries(context, options), expected);
  });
}

test('rejects truncated, malformed, and unexpectedly billed responses', async () => {
  const truncated = response();
  truncated.choices[0].finish_reason = 'length';
  await assert.rejects(
    generateBilingualEntries(context, harness({ completion: truncated }).options),
    /incomplete/,
  );
  const malformed = response();
  malformed.choices[0].message.content = 'not JSON';
  await assert.rejects(
    generateBilingualEntries(context, harness({ completion: malformed }).options),
    /valid release-note JSON/,
  );
  const billed = response();
  billed.usage.cost = 0.01;
  const charged = harness({ model: bothModels, completion: billed });
  await assert.rejects(generateBilingualEntries(context, charged.options), /non-zero/);
  assert.deepEqual(requestedModels(charged.calls), [MODEL]);
});

test('switches after invalid output and regenerates only the failed batch', async () => {
  const source = Array.from({ length: BATCH_SIZE * 2 + 1 }, (_, index) => ({
    ...commits[0],
    sha: index.toString(16).padStart(40, '0'),
  }));
  const batchSizes = [];
  const { options, calls } = harness({
    model: bothModels,
    inference: (init) => {
      const body = JSON.parse(init.body);
      const batch = JSON.parse(body.messages[1].content).commits;
      batchSizes.push(batch.length);
      if (body.model === MODEL && batch[0].sha === source[BATCH_SIZE].sha) {
        return Response.json(response([]));
      }
      return Response.json(response(generated(batch)));
    },
  });
  const entries = await generateBilingualEntries({ ...context, commits: source }, options);
  assert.deepEqual(
    entries.map((entry) => entry.sha),
    source.map((commit) => commit.sha),
  );
  assert.deepEqual(batchSizes, [BATCH_SIZE, BATCH_SIZE, BATCH_SIZE, 1]);
  assert.deepEqual(requestedModels(calls), [MODEL, MODEL, FALLBACK_MODEL, FALLBACK_MODEL]);
  assert.equal(calls.filter((call) => call.url.endsWith('/models')).length, 1);
});
