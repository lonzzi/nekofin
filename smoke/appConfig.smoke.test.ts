import appConfig from '@/app.config';
import type { ExpoConfig } from '@expo/config';
import { describe, expect, it } from 'vitest';

const getConfig = () =>
  appConfig({
    config: {
      name: 'nekofin',
      slug: 'nekofin',
    } as ExpoConfig,
  });

describe('app config smoke', () => {
  it('loads the production Expo config with expected app identifiers', () => {
    const config = getConfig();

    expect(config.name).toBe('nekofin');
    expect(config.slug).toBe('nekofin');
    expect(config.scheme).toBe('nekofin');
    expect(config.ios?.bundleIdentifier).toBe('com.lonzzi.nekofin');
    expect(config.android?.package).toBe('com.lonzzi.nekofin');
  });

  it('keeps critical native plugins registered for prebuild', () => {
    const config = getConfig();
    const pluginNames = (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    );

    expect(pluginNames).toContain('expo-router');
    expect(pluginNames).toContain('expo-build-properties');
    expect(pluginNames).toContain('react-native-video');
    expect(pluginNames).toContain('expo-mpv');
  });

  it('can resolve the custom expo-mpv module used by native builds', async () => {
    const packageJson = await import('expo-mpv/package.json');
    const moduleConfig = await import('expo-mpv/expo-module.config.json');

    expect(packageJson.default.name).toBe('expo-mpv');
    expect(moduleConfig.default.platforms).toEqual(expect.arrayContaining(['android', 'apple']));
  });
});
