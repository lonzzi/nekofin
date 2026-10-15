import {
  defaultDanmakuSourceSettings,
  getDanmakuSources,
  parseDanmakuSourceSettings,
  type DanmakuSourceSettings,
} from '@/services/danmakuSources';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { storage } from '../storage';

type DanmakuSourcesContextValue = {
  sourceSettings: DanmakuSourceSettings;
  setSourceSettings: Dispatch<SetStateAction<DanmakuSourceSettings>>;
  sources: ReturnType<typeof getDanmakuSources>;
};

const DanmakuSourcesContext = createContext<DanmakuSourcesContextValue | null>(null);

export function DanmakuSourcesProvider({ children }: { children: ReactNode }) {
  const [sourceSettings, setSourceSettings] = useState(() =>
    parseDanmakuSourceSettings(storage.getString('danmakuSources')),
  );
  const sources = useMemo(() => getDanmakuSources(sourceSettings), [sourceSettings]);
  const value = useMemo(
    () => ({ sourceSettings, setSourceSettings, sources }),
    [sourceSettings, sources],
  );
  useEffect(() => {
    storage.set('danmakuSources', JSON.stringify(sourceSettings));
  }, [sourceSettings]);
  return <DanmakuSourcesContext.Provider value={value}>{children}</DanmakuSourcesContext.Provider>;
}

// Player Lab supplies only appearance settings and deliberately uses no saved APIs.
const fallbackValue: DanmakuSourcesContextValue = {
  sourceSettings: defaultDanmakuSourceSettings,
  setSourceSettings: () => {},
  sources: getDanmakuSources(defaultDanmakuSourceSettings),
};

export function useDanmakuSources() {
  return useContext(DanmakuSourcesContext) ?? fallbackValue;
}
