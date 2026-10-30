const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { lt, rcompare } = require('semver');
const { parseReleaseTag } = require('./release-metadata.cjs');
const { createClient, withoutMirrorNotes } = require('./cnb-release.cjs');

const START = '<!-- nekofin:changelog:start -->';
const END = '<!-- nekofin:changelog:end -->';
const REPOSITORY = 'lonzzi/nekofin';
const GROUPS = [
  ['feat', '新功能', 'Features'],
  ['fix', '修复', 'Fixes'],
  ['perf', '性能', 'Performance'],
  ['other', '其他改进', 'Other improvements'],
];

function previousRelease(tag, releases, isAncestor = () => true) {
  parseReleaseTag(tag);
  return (
    releases
      .filter((release) => !release.draft)
      .map((release) => release.tag_name)
      .filter((candidate) => {
        try {
          parseReleaseTag(candidate);
          return lt(candidate.slice(1), tag.slice(1)) && isAncestor(candidate);
        } catch {
          return false;
        }
      })
      .sort((a, b) => rcompare(a.slice(1), b.slice(1)))[0] ?? null
  );
}

function changeFromCommit(sha, subject, body = '') {
  if (/^chore\(release\): sync version/.test(subject)) return null;
  const type = /^(\w+)(?:\([^)]*\))?!?:\s*/.exec(subject)?.[1];
  const title = subject
    .replace(/^\w+(?:\([^)]*\))?!?:\s*/, '')
    .replace(/\s*\(#\d+\)$/, '')
    .trim();
  if (!title) return null;
  const pull = /\(#(\d+)\)$/.exec(subject)?.[1];
  const zh = /^Release-Note-ZH:\s*(.+)$/im.exec(body)?.[1]?.trim();
  const en = /^Release-Note-EN:\s*(.+)$/im.exec(body)?.[1]?.trim();
  return {
    sha,
    title,
    group: ['feat', 'fix', 'perf'].includes(type) ? type : 'other',
    url: `https://github.com/${REPOSITORY}/${pull ? `pull/${pull}` : `commit/${sha}`}`,
    label: pull ? `#${pull}` : sha.slice(0, 7),
    zh: zh || (/[\u3400-\u9fff]/.test(title) ? title : undefined),
    en: en || (!/[\u3400-\u9fff]/.test(title) ? title : undefined),
  };
}

function escapeMarkdown(text) {
  return text.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]<>]/g, '\\$&');
}

function renderNotes(tag, previous, changes) {
  parseReleaseTag(tag);
  for (const change of changes) {
    if (
      !change.zh ||
      !/[\u3400-\u9fff]/.test(change.zh) ||
      !change.en ||
      /[\u3400-\u9fff]/.test(change.en)
    )
      throw new Error('Every release entry must contain Chinese and English');
  }
  const lines = [
    START,
    '## 中文',
    '',
    '下载 Android arm64 APK 或未签名 iOS IPA；IPA 需使用侧载工具签名安装。文件校验值见 SHA256SUMS。',
    '',
  ];
  for (const [locale, index] of [
    ['zh', 1],
    ['en', 2],
  ]) {
    if (locale === 'en')
      lines.push(
        '## English',
        '',
        'Download the Android arm64 APK or unsigned iOS IPA. The IPA requires sideload signing. File checksums are listed in SHA256SUMS.',
        '',
      );
    for (const group of GROUPS) {
      const entries = changes.filter((change) => change.group === group[0]);
      if (!entries.length) continue;
      lines.push(
        `### ${group[index]}`,
        '',
        ...entries.map(
          (change) => `- ${escapeMarkdown(change[locale])} ([${change.label}](${change.url}))`,
        ),
        '',
      );
    }
    if (!changes.length)
      lines.push(
        locale === 'zh'
          ? previous
            ? '- 本版本没有额外的代码更改。'
            : '- 首次发布。'
          : previous
            ? '- No additional code changes in this release.'
            : '- Initial release.',
        '',
      );
  }
  lines.push(
    `[完整变更 / Full changelog](https://github.com/${REPOSITORY}/${previous ? `compare/${previous}...${tag}` : `commits/${tag}`})`,
    END,
    '',
  );
  return lines.join('\n');
}

function replaceNotes(current, notes) {
  if (current.includes(START) && current.includes(END))
    return current.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`), notes);
  const cnb = current.match(
    /<!-- nekofin:cnb-downloads:start -->[\s\S]*?<!-- nekofin:cnb-downloads:end -->/,
  )?.[0];
  const original = withoutMirrorNotes(current);
  const generatedLegacy = original.startsWith(
    'Downloads: Android arm64 APK and unsigned iOS IPA (requires sideload signing). SHA256SUMS contains file checksums.',
  );
  return (
    notes +
    (original && !generatedLegacy ? `\n## 补充说明 / Additional notes\n\n${original}\n` : '') +
    (cnb ? `\n${cnb}\n` : '')
  );
}

async function generateNotes(
  tag,
  filename,
  {
    run = execFileSync,
    python = process.env.RELEASE_NOTES_PYTHON || 'python3',
    publish = false,
    env = process.env,
    isAncestor = (candidate) =>
      spawnSync('git', [
        'merge-base',
        '--is-ancestor',
        `refs/tags/${candidate}`,
        `refs/tags/${tag}`,
      ]).status === 0,
  } = {},
) {
  parseReleaseTag(tag);
  const gh = (...args) => run('gh', args, { encoding: 'utf8' });
  const releases = JSON.parse(
    gh('api', `repos/${REPOSITORY}/releases?per_page=100`, '--paginate', '--slurp'),
  ).flat();
  const previous = previousRelease(tag, releases, isAncestor);
  const range = previous ? `${previous}..${tag}` : tag;
  const hashes = run('git', ['log', '--no-merges', '--reverse', '--format=%H', range], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  const changes = hashes
    .map((sha) => {
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid commit identity');
      const text = run('git', ['show', '-s', '--format=%s%n%b', sha], { encoding: 'utf8' });
      const split = text.indexOf('\n');
      return changeFromCommit(sha, text.slice(0, split), text.slice(split + 1));
    })
    .filter(Boolean);
  const pending = changes.filter((change) => !change.zh || !change.en);
  if (pending.length) {
    const translated = JSON.parse(
      run(python, [path.join(__dirname, 'translate-release-notes.py')], {
        encoding: 'utf8',
        input: JSON.stringify(pending),
        maxBuffer: 4_000_000,
      }),
    );
    if (!Array.isArray(translated) || translated.length !== pending.length)
      throw new Error('Incomplete changelog translation');
    for (let i = 0; i < pending.length; i++) {
      if (translated[i].sha !== pending[i].sha)
        throw new Error('Changelog translation identity mismatch');
      pending[i].zh ||= translated[i].zh;
      pending[i].en ||= translated[i].en;
    }
  }
  const notes = renderNotes(tag, previous, changes);
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, notes);
  if (publish) {
    const current = JSON.parse(gh('api', `repos/${REPOSITORY}/releases/tags/${tag}`));
    if (current.draft) throw new Error('Use the Release workflow to finish a draft');
    const updated = replaceNotes(current.body || '', notes);
    writeFileSync(filename, updated);
    if (updated !== current.body)
      gh('release', 'edit', tag, '--repo', REPOSITORY, '--notes-file', filename);
    if (env.CNB_REPO && env.CNB_TOKEN) {
      if (env.CNB_REPO !== REPOSITORY) throw new Error('Unexpected CNB repository');
      const request = createClient(env.CNB_TOKEN);
      const release = await request(
        'GET',
        `/${REPOSITORY}/-/releases/tags/${encodeURIComponent(tag)}`,
        undefined,
        true,
      );
      if (release && !release.draft)
        await request('PATCH', `/${REPOSITORY}/-/releases/${encodeURIComponent(release.id)}`, {
          body: `${withoutMirrorNotes(updated)}\n\n[GitHub Release](${current.html_url})`,
        });
    }
  }
  console.log(
    `Generated Chinese and English release notes for ${tag} (${changes.length} changes).`,
  );
  return notes;
}

module.exports = { changeFromCommit, generateNotes, previousRelease, renderNotes, replaceNotes };
if (require.main === module) {
  const [tag, filename, mode] = process.argv.slice(2);
  if (!tag || !filename || (mode && mode !== '--publish'))
    throw new Error('Usage: release-notes.cjs TAG FILE [--publish]');
  generateNotes(tag, filename, { publish: mode === '--publish' }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
