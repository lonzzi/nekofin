export const brandColors = {
  jellyfin: '#9C4DFF',
  emby: '#4CAF50',
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  page: 20,
  section: 24,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const sizes = {
  iconXs: 12,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  avatarSm: 24,
  avatarMd: 36,
  avatarLg: 44,
  controlSm: 36,
  controlMd: 44,
  controlLg: 56,
} as const;

export const layout = {
  mediaHero: {
    aspectRatio: 16 / 9,
    heightRatio: 0.54,
    minHeight: 360,
    maxHeight: 460,
    scrimHeightRatio: 0.58,
  },
  mediaRail: {
    episodeCardWidth: 220,
    posterCardWidth: 120,
    personCardWidth: 120,
    posterAspectRatio: 2 / 3,
    backdropAspectRatio: 16 / 9,
  },
} as const;

export const typography = {
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyEmphasized: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  title2: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  largeTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
} as const;

export const opacity = {
  disabled: 0.35,
  secondary: 0.68,
  tertiary: 0.42,
  scrim: 0.6,
} as const;

export const zIndex = {
  base: 0,
  floating: 10,
  overlay: 100,
} as const;

export function resolveMediaHeroHeight(windowHeight: number) {
  const { heightRatio, minHeight, maxHeight } = layout.mediaHero;
  const nextHeight = windowHeight * heightRatio;

  return Math.round(Math.min(Math.max(nextHeight, minHeight), maxHeight));
}
