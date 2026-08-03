import {
  DANDAN_COMMENT_MODE,
  type DandanComment,
  type DandanCommentMode,
} from '@/services/dandanplay';

export const PLAYER_LAB_DURATION_MS = 120_000;
export const MAX_SYNTHETIC_DANMAKU = 10_000;

export type RealDanmakuSample = {
  id: string;
  label: string;
  description: string;
  episodeId: number;
  recommendedStartSeconds: number;
};

/**
 * Public DandanPlay episode ids used only as on-demand integration fixtures.
 * The comments themselves are intentionally not checked in or bundled.
 */
export const REAL_DANMAKU_SAMPLES: readonly RealDanmakuSample[] = [
  {
    id: 'dandan-dense-a',
    label: '真实高密样本 A',
    description: '约 7,300 条，适合观察持续高密滚动',
    episodeId: 176170001,
    recommendedStartSeconds: 60,
  },
  {
    id: 'dandan-dense-b',
    label: '真实高密样本 B',
    description: '约 7,200 条，包含较多同帧弹幕',
    episodeId: 176170002,
    recommendedStartSeconds: 60,
  },
  {
    id: 'dandan-mixed',
    label: '真实混合样本',
    description: '约 4,300 条，适合检查不同模式与文本长度',
    episodeId: 188860001,
    recommendedStartSeconds: 45,
  },
] as const;

export type SyntheticDanmakuPresetId = 'balanced' | 'dense' | 'extreme' | 'burst';

export type SyntheticDanmakuPreset = {
  id: SyntheticDanmakuPresetId;
  label: string;
  description: string;
  durationSeconds: number;
  commentsPerSecond: number;
  burstEverySeconds?: number;
  burstSize?: number;
};

export const SYNTHETIC_DANMAKU_PRESETS: readonly SyntheticDanmakuPreset[] = [
  {
    id: 'balanced',
    label: '合成 · 常规',
    description: '2 条/秒，四种模式和中短文本混合',
    durationSeconds: PLAYER_LAB_DURATION_MS / 1000,
    commentsPerSecond: 2,
  },
  {
    id: 'dense',
    label: '合成 · 高密',
    description: '20 条/秒，用于持续碰撞与轨道复用',
    durationSeconds: PLAYER_LAB_DURATION_MS / 1000,
    commentsPerSecond: 20,
  },
  {
    id: 'extreme',
    label: '合成 · 极限',
    description: '60 条/秒，接近逐帧到达的压力样本',
    durationSeconds: PLAYER_LAB_DURATION_MS / 1000,
    commentsPerSecond: 60,
  },
  {
    id: 'burst',
    label: '合成 · Burst',
    description: '4 条/秒，并周期注入 128 条同时间弹幕',
    durationSeconds: PLAYER_LAB_DURATION_MS / 1000,
    commentsPerSecond: 4,
    burstEverySeconds: 20,
    burstSize: 128,
  },
] as const;

export type SyntheticDanmakuOptions = {
  durationSeconds: number;
  commentsPerSecond: number;
  seed?: number;
  burstEverySeconds?: number;
  burstSize?: number;
  maxComments?: number;
};

const COMMENT_MODES: readonly DandanCommentMode[] = [
  DANDAN_COMMENT_MODE.Scroll,
  DANDAN_COMMENT_MODE.Top,
  DANDAN_COMMENT_MODE.Bottom,
  DANDAN_COMMENT_MODE.ScrollBottom,
];

const COLORS = ['#FFFFFF', '#64D2FF', '#FFD60A', '#FF9F0A', '#FF7EB6', '#A8FF78'] as const;

const TEXT_CASES = [
  '这是一条普通弹幕',
  '播放器 UI 检查 ✓',
  '轨道碰撞测试',
  '左右方向都要完整离屏',
  'English WWW iii 0123456789',
  '日本語テスト・한국어 테스트',
  'emoji family 👨‍👩‍👧‍👦 🚀✨',
  '全角字符：ＡＢＣ１２３',
] as const;

const LONG_TEXT =
  '这是一条用于测试超长文本宽度估算、描边渲染、离屏起点与高速播放稳定性的弹幕 WWWWWW 🚀🚀🚀';

const SOURCE_USERS = [
  '[BiliBili] player-lab',
  '[Gamer] player-lab',
  '[DandanPlay]',
  'player-lab-local',
] as const;

function createSeededRandom(seed: number) {
  let state = Math.trunc(seed) >>> 0;
  if (state === 0) state = 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const finiteNonNegative = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

const finitePositiveInteger = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.max(1, Math.trunc(value)) : fallback;

export function getSyntheticDanmakuPreset(id: SyntheticDanmakuPresetId) {
  return SYNTHETIC_DANMAKU_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function generateSyntheticDanmaku({
  durationSeconds,
  commentsPerSecond,
  seed = 0x4e454b4f,
  burstEverySeconds,
  burstSize = 0,
  maxComments = MAX_SYNTHETIC_DANMAKU,
}: SyntheticDanmakuOptions): DandanComment[] {
  const safeDurationSeconds = finitePositiveInteger(durationSeconds, 1);
  const safeCommentsPerSecond = finitePositiveInteger(commentsPerSecond, 1);
  const safeBurstEverySeconds = finiteNonNegative(burstEverySeconds ?? 0, 0);
  const safeBurstSize = finitePositiveInteger(burstSize, 0);
  const safeMaxComments = Math.min(
    MAX_SYNTHETIC_DANMAKU,
    finitePositiveInteger(maxComments, MAX_SYNTHETIC_DANMAKU),
  );
  const random = createSeededRandom(seed);
  const comments: DandanComment[] = [];
  let sequence = 0;

  const append = (timeInSeconds: number, burstIndex?: number) => {
    if (comments.length >= safeMaxComments) return;

    const mode = COMMENT_MODES[sequence % COMMENT_MODES.length];
    const useLongText = sequence % 37 === 0 || (burstIndex != null && burstIndex % 31 === 0);
    const textCase = TEXT_CASES[Math.floor(random() * TEXT_CASES.length) % TEXT_CASES.length];
    const suffix = burstIndex == null ? ` #${sequence + 1}` : ` · burst ${burstIndex + 1}`;

    comments.push({
      id: 1_000_000 + sequence,
      timeInSeconds: Math.max(0, Math.round(timeInSeconds * 1000) / 1000),
      text: `${useLongText ? LONG_TEXT : textCase}${suffix}`,
      colorHex: COLORS[sequence % COLORS.length],
      mode,
      user: SOURCE_USERS[sequence % SOURCE_USERS.length],
    });
    sequence += 1;
  };

  for (
    let second = 0;
    second < safeDurationSeconds && comments.length < safeMaxComments;
    second++
  ) {
    for (
      let index = 0;
      index < safeCommentsPerSecond && comments.length < safeMaxComments;
      index++
    ) {
      const slot = (index + 0.5) / safeCommentsPerSecond;
      const jitterRange = Math.min(0.004, 0.35 / safeCommentsPerSecond);
      const jitter = (random() - 0.5) * jitterRange;
      append(Math.min(safeDurationSeconds, second + slot + jitter));
    }

    const burstAt = second + 1;
    if (
      safeBurstEverySeconds > 0 &&
      safeBurstSize > 0 &&
      burstAt < safeDurationSeconds &&
      burstAt % safeBurstEverySeconds === 0
    ) {
      for (
        let burstIndex = 0;
        burstIndex < safeBurstSize && comments.length < safeMaxComments;
        burstIndex++
      ) {
        append(burstAt, burstIndex);
      }
    }
  }

  return comments.sort(
    (left, right) => left.timeInSeconds - right.timeInSeconds || left.id - right.id,
  );
}

export function generateSyntheticDanmakuPreset(
  id: SyntheticDanmakuPresetId,
  seed?: number,
): DandanComment[] {
  const preset = getSyntheticDanmakuPreset(id);
  if (!preset) return [];

  return generateSyntheticDanmaku({
    durationSeconds: preset.durationSeconds,
    commentsPerSecond: preset.commentsPerSecond,
    burstEverySeconds: preset.burstEverySeconds,
    burstSize: preset.burstSize,
    seed,
  });
}
