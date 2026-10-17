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

export async function applyHotUpdate(
  api: Parameters<typeof downloadHotUpdate>[0] & { reload: () => Promise<void> },
  options: { isUpdatePending: boolean; onApplying: () => void },
) {
  if (!options.isUpdatePending && (await downloadHotUpdate(api)) === 'current') {
    return 'current' as const;
  }
  options.onApplying();
  await api.reload();
  return 'applied' as const;
}
