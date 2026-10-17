export function getNativeReleaseTag(channel: string | null) {
  return channel?.match(/^(?:production|preview|development)-(v\d[^\s/]*)$/)?.[1];
}

export function isProductionBuild(channel: string | null, configuredVariant: unknown) {
  return channel ? channel.startsWith('production-') : configuredVariant === 'production';
}
