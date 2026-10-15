import type { DandanComment } from './dandanplay';

// Proxies round timestamps differently. Compare a real interval, not rounded buckets.
const TIME_TOLERANCE = 0.25;
const PROVIDER_NAMES = new Map([
  ['bilibili', 'bilibili'],
  ['gamer', 'bahamut'],
  ['bahamut', 'bahamut'],
  ['dandan', 'dandanplay'],
  ['dandanplay', 'dandanplay'],
]);

type Author = { id: string; provider?: string };
type CommentGroup = {
  comment: DandanComment;
  author?: Author;
  tracks: Set<number>;
};

function commentAuthor(user: string): Author | undefined {
  let id = user.trim();
  let provider: string | undefined;
  let tag: RegExpExecArray | null;
  while ((tag = /^\[([^\]]+)\]/.exec(id))) {
    if (/^\[[\da-f]{8,64}\]$/i.test(id)) {
      id = id.slice(1, -1);
      break;
    }
    const name = tag[1].trim().toLowerCase();
    provider = PROVIDER_NAMES.get(name) ?? name;
    id = id.slice(tag[0].length).trim();
  }
  // A provider tag alone is not a user ID. Some APIs replace every sender with it.
  if (!id || /^(?:\[\]|0|-1|unknown|anonymous|null|undefined)$/i.test(id)) return undefined;
  if (/^[\da-f]{8,64}$/i.test(id)) id = id.toLowerCase();
  return { id, provider };
}

function sameAuthor(a?: Author, b?: Author): boolean | undefined {
  if (!a || !b) return undefined;
  return a.id === b.id && (!a.provider || !b.provider || a.provider === b.provider);
}

function sameStyle(a: DandanComment, b: DandanComment): boolean {
  return a.mode === b.mode && a.colorHex.toLowerCase() === b.colorHex.toLowerCase();
}

function contentKey(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200b\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tracks are ordered by preference; retain their original text, style and source labels. */
export function mergeDanmakuComments(
  tracks: readonly (readonly DandanComment[])[],
): DandanComment[] {
  const byContent = new Map<string, Map<number, CommentGroup[]>>();
  const groups: CommentGroup[] = [];
  tracks.forEach((comments, trackIndex) => {
    for (const comment of [...comments].sort((a, b) => a.timeInSeconds - b.timeInSeconds)) {
      const key = contentKey(comment.text);
      const author = commentAuthor(comment.user);
      const bucket = Math.floor(comment.timeInSeconds / TIME_TOLERANCE);
      const timeline = byContent.get(key) ?? new Map<number, CommentGroup[]>();
      let match: CommentGroup | undefined;
      let matchHasAuthor = false;
      for (let index = bucket - 1; index <= bucket + 1; index++) {
        for (const group of timeline.get(index) ?? []) {
          if (Math.abs(group.comment.timeInSeconds - comment.timeInSeconds) > TIME_TOLERANCE + 1e-6)
            continue;
          const authorMatch = sameAuthor(group.author, author);
          if (authorMatch === false) continue;
          const sameTrack = group.tracks.has(trackIndex);
          // Match unknown senders only across tracks, once per track. This preserves
          // the number of simultaneous chants when a proxy discards sender IDs.
          if (sameTrack && authorMatch !== true) continue;
          if ((sameTrack || authorMatch !== true) && !sameStyle(group.comment, comment)) continue;
          const hasAuthor = authorMatch === true;
          if (
            !match ||
            (hasAuthor && !matchHasAuthor) ||
            (hasAuthor === matchHasAuthor &&
              group.comment.timeInSeconds < match.comment.timeInSeconds)
          ) {
            match = group;
            matchHasAuthor = hasAuthor;
          }
        }
      }
      if (match) {
        match.tracks.add(trackIndex);
        if (author)
          match.author = { ...author, provider: author.provider ?? match.author?.provider };
        continue;
      }
      const group: CommentGroup = { comment, author, tracks: new Set([trackIndex]) };
      const entries = timeline.get(bucket) ?? [];
      entries.push(group);
      timeline.set(bucket, entries);
      byContent.set(key, timeline);
      groups.push(group);
    }
  });
  return groups
    .map((group) => group.comment)
    .sort((a, b) => a.timeInSeconds - b.timeInSeconds)
    .map((comment, index) => ({ ...comment, id: index + 1 }));
}
