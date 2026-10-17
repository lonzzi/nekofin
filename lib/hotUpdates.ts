export async function downloadHotUpdate(api: {
  check: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetch: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
}) {
  const result = await api.check();
  if (!result.isAvailable && !result.isRollBackToEmbedded) return 'current' as const;
  const downloaded = await api.fetch();
  return downloaded.isNew || downloaded.isRollBackToEmbedded
    ? ('pending' as const)
    : ('current' as const);
}
