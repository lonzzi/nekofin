export type DetailToolbarField = 'favorite' | 'watched';

type DetailToolbarItemOverride = Partial<Record<DetailToolbarField, boolean>>;

export type DetailToolbarOverrides = Readonly<Record<string, DetailToolbarItemOverride>>;

export function resolveDetailToolbarState({
  itemId,
  itemIsFavorite,
  itemIsWatched,
  overrides,
}: {
  itemId: string | undefined;
  itemIsFavorite: boolean;
  itemIsWatched: boolean;
  overrides: DetailToolbarOverrides;
}) {
  if (!itemId) {
    return { isFavorite: false, isWatched: false } as const;
  }

  const itemOverride = overrides[itemId];
  return {
    isFavorite: itemOverride?.favorite ?? itemIsFavorite,
    isWatched: itemOverride?.watched ?? itemIsWatched,
  } as const;
}

export function withDetailToolbarOverride(
  overrides: DetailToolbarOverrides,
  itemId: string,
  field: DetailToolbarField,
  value: boolean,
): DetailToolbarOverrides {
  return {
    ...overrides,
    [itemId]: {
      ...overrides[itemId],
      [field]: value,
    },
  };
}
