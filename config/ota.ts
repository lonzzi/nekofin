export type OtaVariant = 'development' | 'preview' | 'production';

export function getBuildRuntimeVersion(value: string | undefined) {
  if (!value) return { policy: 'fingerprint' as const };
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) {
    throw new Error('NEKOFIN_NATIVE_RUNTIME must be a 40- or 64-character native fingerprint.');
  }
  return value;
}

export function getOtaChannel(variant: OtaVariant, releaseTag: string | null, version: string) {
  return `${variant}-${releaseTag ?? `v${version}`}`;
}

export function validateOtaURL(value: string | undefined) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(
      'NEKOFIN_OTA_URL must be a public HTTPS manifest URL without credentials or query parameters.',
    );
  }
  return url.toString();
}
