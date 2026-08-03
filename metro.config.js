const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Player Lab is fail-closed: only an explicitly development-flavoured bundle
// resolves `PlayerLabEntry.development.tsx`. Preview, production, and local
// builds without APP_VARIANT resolve the inert `PlayerLabEntry.tsx` stub, so
// the lab implementation and fixtures never enter those dependency graphs.
if (process.env.APP_VARIANT === 'development') {
  config.resolver.sourceExts = ['development.tsx', ...config.resolver.sourceExts];
}

module.exports = config;
