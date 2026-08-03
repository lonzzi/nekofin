import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { TextStyle } from 'react-native';

import { storage } from '../storage';

export type DanmakuCollisionPolicy = 'avoid' | 'allow';

export type DanmakuSettingsType = {
  enabled: boolean;
  opacity: number;
  speed: number;
  fontSize: number;
  heightRatio: number;
  danmakuFilter: number;
  danmakuModeFilter: number;
  danmakuDensityLimit: number;
  collisionPolicy: DanmakuCollisionPolicy;
  curEpOffset: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
};

type DanmakuSettingsContextValue = {
  settings: DanmakuSettingsType;
  setSettings: Dispatch<SetStateAction<DanmakuSettingsType>>;
};

export const defaultSettings: DanmakuSettingsType = {
  enabled: true,
  opacity: 0.8,
  speed: 140,
  fontSize: 20,
  heightRatio: 0.9,
  danmakuFilter: 0,
  danmakuModeFilter: 0,
  danmakuDensityLimit: 0,
  collisionPolicy: 'avoid',
  curEpOffset: 0,
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  fontWeight: '700',
};

const LEGACY_DISABLED_SOURCE_FILTER = 15;
const SUPPORTED_FONT_WEIGHTS = new Set([
  'normal',
  'bold',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
]);

const finiteNumber = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : fallback;

const finiteInteger = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  Math.trunc(finiteNumber(value, fallback, minimum, maximum));

export function parseDanmakuSettings(savedSettings?: string): DanmakuSettingsType {
  if (!savedSettings) {
    return defaultSettings;
  }

  try {
    const parsedSettings = JSON.parse(savedSettings) as Partial<DanmakuSettingsType> | null;

    if (!parsedSettings || typeof parsedSettings !== 'object' || Array.isArray(parsedSettings)) {
      return defaultSettings;
    }

    const wasDisabledByLegacyPlayerToggle =
      !Object.prototype.hasOwnProperty.call(parsedSettings, 'enabled') &&
      parsedSettings.danmakuFilter === LEGACY_DISABLED_SOURCE_FILTER;

    const fontFamily =
      typeof parsedSettings.fontFamily === 'string' && parsedSettings.fontFamily.trim()
        ? parsedSettings.fontFamily
        : defaultSettings.fontFamily;
    const fontWeight =
      typeof parsedSettings.fontWeight === 'string' &&
      SUPPORTED_FONT_WEIGHTS.has(parsedSettings.fontWeight)
        ? (parsedSettings.fontWeight as TextStyle['fontWeight'])
        : defaultSettings.fontWeight;

    return {
      enabled: wasDisabledByLegacyPlayerToggle
        ? false
        : typeof parsedSettings.enabled === 'boolean'
          ? parsedSettings.enabled
          : defaultSettings.enabled,
      opacity: finiteNumber(parsedSettings.opacity, defaultSettings.opacity, 0.1, 1),
      speed: finiteNumber(parsedSettings.speed, defaultSettings.speed, 80, 240),
      fontSize: finiteNumber(parsedSettings.fontSize, defaultSettings.fontSize, 12, 36),
      heightRatio: finiteNumber(parsedSettings.heightRatio, defaultSettings.heightRatio, 0.3, 1),
      // The old quick toggle disabled danmaku by filtering every source and
      // restored all sources when toggled back on. Preserve that behavior so
      // enabling the new master switch cannot leave the screen silently empty.
      danmakuFilter: wasDisabledByLegacyPlayerToggle
        ? defaultSettings.danmakuFilter
        : finiteInteger(parsedSettings.danmakuFilter, defaultSettings.danmakuFilter, 0, 15),
      danmakuModeFilter: finiteInteger(
        parsedSettings.danmakuModeFilter,
        defaultSettings.danmakuModeFilter,
        0,
        7,
      ),
      danmakuDensityLimit: finiteInteger(
        parsedSettings.danmakuDensityLimit,
        defaultSettings.danmakuDensityLimit,
        0,
        4,
      ),
      collisionPolicy:
        parsedSettings.collisionPolicy === 'allow' || parsedSettings.collisionPolicy === 'avoid'
          ? parsedSettings.collisionPolicy
          : defaultSettings.collisionPolicy,
      curEpOffset: finiteNumber(parsedSettings.curEpOffset, defaultSettings.curEpOffset, -5, 5),
      fontFamily,
      fontWeight,
    };
  } catch {
    return defaultSettings;
  }
}

const DanmakuSettingsContext = createContext<DanmakuSettingsContextValue | null>(null);

export function DanmakuSettingsProvider({
  children,
  initialSettings,
  persist = true,
}: {
  children: React.ReactNode;
  initialSettings?: DanmakuSettingsType;
  persist?: boolean;
}) {
  const [settings, setSettings] = useState<DanmakuSettingsType>(() => {
    if (initialSettings) return initialSettings;
    const savedSettings = storage.getString('danmakuSettings');
    return parseDanmakuSettings(savedSettings);
  });

  const value = useMemo(() => ({ settings, setSettings }), [settings]);

  useEffect(() => {
    if (!persist) return;
    storage.set('danmakuSettings', JSON.stringify(settings));
  }, [persist, settings]);

  return (
    <DanmakuSettingsContext.Provider value={value}>{children}</DanmakuSettingsContext.Provider>
  );
}

export function useDanmakuSettings() {
  const ctx = useContext(DanmakuSettingsContext);
  if (!ctx) {
    throw new Error('useDanmakuSettings must be used within DanmakuSettingsProvider');
  }
  return ctx;
}
