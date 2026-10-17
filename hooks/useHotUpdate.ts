import { applyHotUpdate } from '@/lib/hotUpdates';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';

export function useHotUpdate() {
  const updates = Updates.useUpdates();
  const [result, setResult] = useState<'idle' | 'checking' | 'applying' | 'current' | 'error'>(
    'idle',
  );
  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const available = !__DEV__ && Updates.isEnabled;
  const busy =
    result === 'checking' || result === 'applying' || updates.isChecking || updates.isDownloading;
  const subtitle = !available
    ? __DEV__
      ? '开发模式下不可用'
      : '此安装包暂不支持在线更新'
    : result === 'applying'
      ? '正在应用更新…'
      : updates.isDownloading
        ? '正在下载更新…'
        : busy
          ? '正在检查更新…'
          : result === 'error'
            ? '更新失败，点按重试'
            : updates.isUpdatePending
              ? '更新已准备好，点按立即应用'
              : result === 'current'
                ? '当前已是最新版本'
                : '下载并立即应用可用更新';

  function fetchAndApply() {
    if (!available || busy || inFlight.current) return inFlight.current ?? Promise.resolve();
    setResult('checking');
    inFlight.current = applyHotUpdate(
      {
        check: Updates.checkForUpdateAsync,
        fetch: Updates.fetchUpdateAsync,
        reload: Updates.reloadAsync,
      },
      {
        isUpdatePending: updates.isUpdatePending,
        onApplying: () => {
          if (mounted.current) setResult('applying');
        },
      },
    )
      .then((status) => {
        if (mounted.current && status === 'current') setResult('current');
      })
      .catch(() => {
        if (mounted.current) setResult('error');
      })
      .finally(() => {
        inFlight.current = null;
      });
    return inFlight.current;
  }

  return {
    available,
    busy,
    subtitle,
    fetchAndApply,
    resourceVersion: !Updates.isEnabled
      ? null
      : Updates.isEmbeddedLaunch
        ? '随安装包提供'
        : (Updates.updateId?.slice(0, 8) ?? '已更新'),
  };
}
