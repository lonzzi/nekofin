/** Ratings are shown with a single decimal place throughout the app. */
export const formatRating = (rating: number): string => rating.toFixed(1);

export const formatBitrate = (
  bps: number | null | undefined,
  options?: { unit?: 'bits' | 'bytes' },
): string => {
  if (!bps || bps <= 0) return '未知';

  const useBytes = options?.unit === 'bytes';

  if (useBytes) {
    const MBps = bps / 8 / 1000000;
    const KBps = bps / 8 / 1000;

    if (MBps >= 1) {
      return `${MBps.toFixed(2)} MB/s`;
    }

    return `${KBps.toFixed(2)} KB/s`;
  }

  const mbps = bps / 1000000;
  const kbps = bps / 1000;

  if (mbps >= 1) {
    return `${mbps.toFixed(1)} Mbps`;
  }

  if (kbps >= 1) {
    return `${kbps.toFixed(0)} Kbps`;
  }

  return `${bps.toFixed(0)} bps`;
};
