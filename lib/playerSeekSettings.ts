export const PLAYER_SEEK_SECONDS = [5, 10, 15, 30, 60] as const;
export const DEFAULT_PLAYER_SEEK_SECONDS = 10;

export function parsePlayerSeekSeconds(value?: number) {
  return PLAYER_SEEK_SECONDS.find((seconds) => seconds === value) ?? DEFAULT_PLAYER_SEEK_SECONDS;
}
