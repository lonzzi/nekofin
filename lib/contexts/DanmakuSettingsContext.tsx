import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, TextStyle } from 'react-native';

import { storage } from '../storage';

export type DanmakuSettingsType = {
  opacity: number;
  speed: number;
  fontSize: number;
  heightRatio: number;
  danmakuFilter: number;
  danmakuModeFilter: number;
  danmakuDensityLimit: number;
  curEpOffset: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
};

type DanmakuSettingsContextValue = {
  settings: DanmakuSettingsType;
  setSettings: (next: DanmakuSettingsType) => void;
};

export const defaultSettings: DanmakuSettingsType = {
  opacity: 0.8,
  speed: 140,
  fontSize: Platform.OS === 'ios' ? 18 : 20,
  heightRatio: 0.9,
  danmakuFilter: 0,
  danmakuModeFilter: 0,
  danmakuDensityLimit: 0,
  curEpOffset: 0,
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  fontWeight: '700',
};

const DanmakuSettingsContext = createContext<DanmakuSettingsContextValue | null>(null);

export function DanmakuSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DanmakuSettingsType>(() => {
    const savedSettings = storage.getString('danmakuSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });

  const value = useMemo(() => ({ settings, setSettings }), [settings]);

  useEffect(() => {
    storage.set('danmakuSettings', JSON.stringify(settings));
  }, [settings]);

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
