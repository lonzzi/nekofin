export type OtaVariant = 'development' | 'preview' | 'production';

export function getOtaChannel(variant: OtaVariant, releaseTag: string | null, version: string) {
  return `${variant}-${releaseTag ?? `v${version}`}`;
}

export function getNativeReleaseTag(channel: string | null) {
  return channel?.match(/^(?:production|preview|development)-(v\d[^\s/]*)$/)?.[1];
}

export function isProductionBuild(channel: string | null, configuredVariant: unknown) {
  return channel ? channel.startsWith('production-') : configuredVariant === 'production';
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
