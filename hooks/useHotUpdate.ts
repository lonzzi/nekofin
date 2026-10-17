import { downloadHotUpdate } from '@/lib/hotUpdates';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';

export function useHotUpdate() {
  const updates = Updates.useUpdates();
  const [result, setResult] = useState<'idle' | 'checking' | 'pending' | 'current' | 'error'>(
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
  const busy = result === 'checking' || updates.isChecking || updates.isDownloading;
  const pending = result === 'pending' || updates.isUpdatePending;
  const subtitle = !available
    ? __DEV__
      ? '开发模式下不可用'
      : '此安装包暂不支持热更新'
    : updates.isDownloading
      ? '正在下载更新…'
      : busy
        ? '正在检查热更新…'
        : pending
          ? '更新已准备好，下次启动生效'
          : result === 'current'
            ? '当前资源已是最新版本'
            : result === 'error'
              ? '检查失败，请检查网络后重试'
              : '后台下载更新，下次启动生效';

  function check() {
    if (!available || busy || inFlight.current) return inFlight.current ?? Promise.resolve();
    setResult('checking');
    inFlight.current = downloadHotUpdate({
      check: Updates.checkForUpdateAsync,
      fetch: Updates.fetchUpdateAsync,
    })
      .then((status) => {
        if (mounted.current) setResult(status);
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
    check,
    resourceVersion: !Updates.isEnabled
      ? null
      : Updates.isEmbeddedLaunch
        ? '随安装包提供'
        : (Updates.updateId?.slice(0, 8) ?? '已更新'),
  };
}
