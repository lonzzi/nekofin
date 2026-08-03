import { DANDAN_COMMENT_MODE, DandanComment } from '@/services/dandanplay';

export interface DanmakuFilterOptions {
  curEpOffset: number;
  danmakuFilter: number;
  danmakuModeFilter: number;
  danmakuDensityLimit: number;
  width: number;
  height: number;
  heightRatio: number;
  speed: number;
  fontSize: number;
}

export const shouldKeepCommentSource = (comment: DandanComment, danmakuFilter: number) => {
  if (danmakuFilter <= 0) return true;

  const user = comment.user || '';

  if ((danmakuFilter & 1) === 1 && user.includes('[BiliBili]')) {
    return false;
  }

  if ((danmakuFilter & 2) === 2 && user.includes('[Gamer]')) {
    return false;
  }

  if ((danmakuFilter & 4) === 4 && user.startsWith('[') && user.endsWith(']')) {
    return false;
  }

  if (
    (danmakuFilter & 8) === 8 &&
    !user.includes('[BiliBili]') &&
    !user.includes('[Gamer]') &&
    !user.startsWith('[')
  ) {
    return false;
  }

  return true;
};

export const shouldKeepCommentMode = (comment: DandanComment, danmakuModeFilter: number) => {
  if (danmakuModeFilter <= 0) return true;

  if ((danmakuModeFilter & 1) === 1 && comment.mode === DANDAN_COMMENT_MODE.Bottom) {
    return false;
  }

  if ((danmakuModeFilter & 2) === 2 && comment.mode === DANDAN_COMMENT_MODE.Top) {
    return false;
  }

  if (
    (danmakuModeFilter & 4) === 4 &&
    (comment.mode === DANDAN_COMMENT_MODE.Scroll ||
      comment.mode === DANDAN_COMMENT_MODE.ScrollBottom)
  ) {
    return false;
  }

  return true;
};

export const applyDanmakuDensityLimit = (
  comments: DandanComment[],
  _options: Pick<
    DanmakuFilterOptions,
    'danmakuDensityLimit' | 'width' | 'height' | 'heightRatio' | 'speed' | 'fontSize'
  >,
) => {
  // Density is enforced against the actual number of mounted StrokeText views
  // in DanmakuLayer. Static media-time buckets cannot model long text, adjacent
  // buckets, playback rate, or fixed comments and can still overload a frame.
  // Keep this stage immutable and deterministic so the scheduler can advance a
  // single sorted cursor and drop overflow without leaving a backlog.
  return comments.slice().sort((a, b) => a.timeInSeconds - b.timeInSeconds);
};

export const filterDanmakuComments = (comments: DandanComment[], options: DanmakuFilterOptions) => {
  if (!comments.length) return [];

  const offsetComments = comments
    .map((comment) => ({
      ...comment,
      timeInSeconds: comment.timeInSeconds + options.curEpOffset,
    }))
    .filter((comment) => comment.timeInSeconds >= 0);

  const filteredBySource = offsetComments.filter((comment) =>
    shouldKeepCommentSource(comment, options.danmakuFilter),
  );
  const filteredByMode = filteredBySource.filter((comment) =>
    shouldKeepCommentMode(comment, options.danmakuModeFilter),
  );

  return applyDanmakuDensityLimit(filteredByMode, options);
};
