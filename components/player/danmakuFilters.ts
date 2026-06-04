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
  playbackRate: number;
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
  {
    danmakuDensityLimit,
    width,
    height,
    heightRatio,
    speed,
    playbackRate,
    fontSize,
  }: Pick<
    DanmakuFilterOptions,
    | 'danmakuDensityLimit'
    | 'width'
    | 'height'
    | 'heightRatio'
    | 'speed'
    | 'playbackRate'
    | 'fontSize'
  >,
) => {
  if (danmakuDensityLimit <= 0) return comments.sort((a, b) => a.timeInSeconds - b.timeInSeconds);

  const earlyDensityGraceSeconds = 8;
  const containerHeight = height * heightRatio - 18;
  const duration = Math.ceil(width / Math.max(1, speed * Math.max(0.25, playbackRate)));
  const lines = Math.floor(containerHeight / fontSize) - 1;

  const limit = (9 - danmakuDensityLimit * 2) * lines;
  const verticalLimit = lines - 1 > 0 ? lines - 1 : 1;

  const timeBuckets: Record<number, number> = {};
  const verticalTimeBuckets: Record<number, number> = {};
  const resultComments: DandanComment[] = [];

  comments.forEach((comment) => {
    if (comment.timeInSeconds <= earlyDensityGraceSeconds) {
      resultComments.push(comment);
      return;
    }

    const timeIndex = Math.ceil(comment.timeInSeconds / duration);
    timeBuckets[timeIndex] ??= 0;
    verticalTimeBuckets[timeIndex] ??= 0;

    if (comment.mode === DANDAN_COMMENT_MODE.Top || comment.mode === DANDAN_COMMENT_MODE.Bottom) {
      if (verticalTimeBuckets[timeIndex] < verticalLimit) {
        verticalTimeBuckets[timeIndex]++;
        resultComments.push(comment);
      }
      return;
    }

    if (timeBuckets[timeIndex] < limit) {
      timeBuckets[timeIndex]++;
      resultComments.push(comment);
    }
  });

  return resultComments;
};

export const filterDanmakuComments = (comments: DandanComment[], options: DanmakuFilterOptions) => {
  if (!comments.length) return [];

  const offsetComments = comments.map((comment) => ({
    ...comment,
    timeInSeconds: comment.timeInSeconds + options.curEpOffset,
  }));

  const filteredBySource = offsetComments.filter((comment) =>
    shouldKeepCommentSource(comment, options.danmakuFilter),
  );
  const filteredByMode = filteredBySource.filter((comment) =>
    shouldKeepCommentMode(comment, options.danmakuModeFilter),
  );

  return applyDanmakuDensityLimit(filteredByMode, options);
};
