import { DANDAN_COMMENT_MODE, type DandanCommentMode } from '@/services/dandanplay';
import { describe, expect, it } from 'vitest';

import { calculateDanmakuActiveHardLimit } from './danmakuCollision';
import {
  addDanmakuLaneBullet,
  createDanmakuLaneOccupancy,
  pickDanmakuLane,
  type DanmakuLaneOccupancy,
} from './danmakuLanes';
import {
  calculateDanmakuLayout,
  calculateDanmakuScrollTrajectory,
  createActiveDanmakuBullet,
  type DanmakuRuntimeLayout,
} from './danmakuLayout';
import { findNextDanmakuEventTimeMs, removeExpiredDanmakuEntries } from './danmakuScheduler';
import type { ActiveBullet } from './DanmakuTypes';

const modes = Object.values(DANDAN_COMMENT_MODE);
const scrollModes = [DANDAN_COMMENT_MODE.Scroll, DANDAN_COMMENT_MODE.ScrollBottom];
const runtime: DanmakuRuntimeLayout = {
  height: 84,
  heightRatio: 1,
  lineHeight: 28,
  layout: calculateDanmakuLayout(3),
  playbackRate: 1,
  speed: 140,
  width: 800,
};
const singleRowRuntime = { ...runtime, height: 28, layout: calculateDanmakuLayout(1) };

function bullet(
  mode: DandanCommentMode,
  options: {
    scheduledMs?: number;
    rowIndex?: number;
    textWidth?: number;
    runtime?: DanmakuRuntimeLayout;
  } = {},
): ActiveBullet {
  return createActiveDanmakuBullet({
    comment: { id: 1, text: '弹幕', mode, timeInSeconds: 0, colorHex: '#fff', user: '' },
    instanceId: 1,
    rowIndex: options.rowIndex ?? 0,
    scheduledMs: options.scheduledMs ?? 0,
    textWidth: options.textWidth ?? 50,
    runtime: options.runtime ?? runtime,
  });
}

function pick(
  incoming: ActiveBullet,
  occupancy: DanmakuLaneOccupancy,
  options: {
    runtime?: DanmakuRuntimeLayout;
    collisionPolicy?: 'allow' | 'avoid';
  } = {},
) {
  return pickDanmakuLane({
    bullet: incoming,
    collisionPolicy: options.collisionPolicy ?? 'avoid',
    occupancy,
    rowMinGapPx: 40,
    runtime: options.runtime ?? runtime,
  });
}

describe('independent danmaku lanes', () => {
  it.each(
    modes.flatMap((existing) =>
      modes.filter((mode) => mode !== existing).map((incoming) => [existing, incoming] as const),
    ),
  )('lets mode %i enter the same visual row occupied by mode %i', (existingMode, incomingMode) => {
    const active = bullet(existingMode, { runtime: singleRowRuntime });
    const occupancy = createDanmakuLaneOccupancy([active], runtime.lineHeight);
    expect(
      pick(bullet(incomingMode, { scheduledMs: 1000, runtime: singleRowRuntime }), occupancy, {
        runtime: singleRowRuntime,
      }),
    ).toEqual({ rowIndex: 0, top: 0 });
  });

  it('admits a mixed equal-time burst but blocks another comment in each same-mode lane', () => {
    const occupancy = createDanmakuLaneOccupancy([], runtime.lineHeight);
    for (const mode of modes) {
      const incoming = bullet(mode, { scheduledMs: 1000, runtime: singleRowRuntime });
      const placement = pick(incoming, occupancy, { runtime: singleRowRuntime });
      expect(placement).toEqual({ rowIndex: 0, top: 0 });
      addDanmakuLaneBullet(occupancy, { ...incoming, top: placement!.top }, runtime.lineHeight);
    }
    for (const mode of modes) {
      expect(
        pick(bullet(mode, { scheduledMs: 1000, runtime: singleRowRuntime }), occupancy, {
          runtime: singleRowRuntime,
        }),
      ).toBeNull();
    }
  });

  it('keeps top and bottom lanes available when scrolling occupies every visual row', () => {
    const occupancy = createDanmakuLaneOccupancy(
      [0, 1, 2].map((rowIndex) => bullet(DANDAN_COMMENT_MODE.Scroll, { rowIndex })),
      runtime.lineHeight,
    );
    expect(pick(bullet(DANDAN_COMMENT_MODE.Top), occupancy)).toEqual({ rowIndex: 0, top: 0 });
    expect(pick(bullet(DANDAN_COMMENT_MODE.Bottom), occupancy)).toEqual({ rowIndex: 2, top: 56 });
  });

  it.each([
    [DANDAN_COMMENT_MODE.Top, [0, 28, 56]],
    [DANDAN_COMMENT_MODE.Bottom, [56, 28, 0]],
  ] as const)(
    'stacks fixed mode %i from its own edge and rejects overflow',
    (mode, expectedTops) => {
      const occupancy = createDanmakuLaneOccupancy([], runtime.lineHeight);
      const tops: number[] = [];
      for (let index = 0; index < 3; index++) {
        const incoming = bullet(mode);
        const placement = pick(incoming, occupancy);
        expect(placement).not.toBeNull();
        tops.push(placement!.top);
        addDanmakuLaneBullet(occupancy, { ...incoming, top: placement!.top }, runtime.lineHeight);
      }
      expect(tops).toEqual(expectedTops);
      expect(pick(bullet(mode), occupancy)).toBeNull();
    },
  );

  it.each([0.5, 1, 2, 4])('reserves fixed lanes until expiry at %sx playback', (playbackRate) => {
    const rateRuntime = { ...singleRowRuntime, playbackRate };
    for (const mode of [DANDAN_COMMENT_MODE.Top, DANDAN_COMMENT_MODE.Bottom]) {
      const active = bullet(mode, { runtime: rateRuntime });
      const occupancy = createDanmakuLaneOccupancy([active], runtime.lineHeight);
      expect(
        pick(bullet(mode, { scheduledMs: 3999, runtime: rateRuntime }), occupancy, {
          runtime: rateRuntime,
        }),
      ).toBeNull();
      expect(
        pick(bullet(mode, { scheduledMs: 4000, runtime: rateRuntime }), occupancy, {
          runtime: rateRuntime,
        }),
      ).toEqual({ rowIndex: 0, top: 0 });
    }
  });

  it.each(scrollModes)('predicts same-direction catch-up for scrolling mode %i', (mode) => {
    const active = bullet(mode, { runtime: singleRowRuntime });
    const occupancy = createDanmakuLaneOccupancy([active], runtime.lineHeight);
    expect(
      pick(
        bullet(mode, { scheduledMs: 2000, textWidth: 800, runtime: singleRowRuntime }),
        occupancy,
        {
          runtime: singleRowRuntime,
        },
      ),
    ).toBeNull();
    expect(
      pick(bullet(mode, { scheduledMs: 2000, runtime: singleRowRuntime }), occupancy, {
        runtime: singleRowRuntime,
      }),
    ).toEqual({ rowIndex: 0, top: 0 });
  });

  it.each(scrollModes)(
    'releases mode %i at the visible edge, including the density budget',
    (mode) => {
      for (const playbackRate of [0.5, 1, 2, 4]) {
        const rateRuntime = { ...singleRowRuntime, playbackRate };
        const active = bullet(mode, { scheduledMs: 1000, runtime: rateRuntime });
        const exitTimeMs = active.scheduledMs + active.visibleMediaDurationMs;
        expect(exitTimeMs).toBeLessThan(active.scheduledMs + active.mediaDurationMs);
        const position = calculateDanmakuScrollTrajectory({
          mode,
          progress: active.visibleMediaDurationMs / active.mediaDurationMs,
          textWidth: active.textWidth,
          width: runtime.width,
        });
        expect(
          mode === DANDAN_COMMENT_MODE.Scroll ? position.right : position.left - runtime.width,
        ).toBeCloseTo(0);
        expect(
          findNextDanmakuEventTimeMs({ activeBullets: [active], nextCommentTimeMs: null }),
        ).toBe(exitTimeMs);
        expect(removeExpiredDanmakuEntries([active], exitTimeMs - 1)).toEqual([active]);
        const retained = removeExpiredDanmakuEntries([active], exitTimeMs);
        expect(retained).toHaveLength(0);
        expect(retained.length).toBeLessThan(calculateDanmakuActiveHardLimit(1, 4));

        // Even an occupancy snapshot retaining the animation object cannot block
        // the lane after its text has exited the viewport.
        const occupancy = createDanmakuLaneOccupancy([active], runtime.lineHeight);
        expect(
          pick(bullet(mode, { scheduledMs: exitTimeMs, runtime: rateRuntime }), occupancy, {
            runtime: rateRuntime,
          }),
        ).toEqual({ rowIndex: 0, top: 0 });
      }
    },
  );

  it('uses only the incoming mode when scoring overlapping fallback lanes', () => {
    const occupancy = createDanmakuLaneOccupancy(
      [
        ...Array.from({ length: 4 }, () => bullet(DANDAN_COMMENT_MODE.Top)),
        bullet(DANDAN_COMMENT_MODE.Scroll),
        bullet(DANDAN_COMMENT_MODE.Scroll, { rowIndex: 1 }),
        bullet(DANDAN_COMMENT_MODE.Scroll, { rowIndex: 1 }),
        bullet(DANDAN_COMMENT_MODE.Scroll, { rowIndex: 2 }),
        bullet(DANDAN_COMMENT_MODE.Scroll, { rowIndex: 2 }),
      ],
      runtime.lineHeight,
    );
    expect(pick(bullet(DANDAN_COMMENT_MODE.Scroll), occupancy)).toBeNull();
    expect(
      pick(bullet(DANDAN_COMMENT_MODE.Scroll), occupancy, { collisionPolicy: 'allow' }),
    ).toMatchObject({ rowIndex: 0, top: 0 });
  });
});
