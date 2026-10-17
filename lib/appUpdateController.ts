import type { AppRelease } from './appUpdates';

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type UpdateStorage = {
  getNumber: (key: string) => number | undefined;
  getString: (key: string) => string | undefined;
  set: (key: string, value: number | string) => void;
};

export type UpdateSnapshot = {
  status: 'idle' | 'checking' | 'available' | 'current' | 'error';
  release: AppRelease | null;
  error?: string;
};

export type UpdatePromptActions = {
  ignore: () => void;
  later: () => void;
  open: () => void;
};

type Dependencies = {
  currentVersion: string | null;
  automaticEnabled: boolean;
  storage: UpdateStorage;
  fetchUpdate: () => Promise<AppRelease | null>;
  showUpdate: (release: AppRelease, actions: UpdatePromptActions) => void;
  showMessage: (title: string, message: string, dismiss: () => void) => void;
  openURL: (url: string) => Promise<unknown>;
  now?: () => number;
};

export function createAppUpdateController(dependencies: Dependencies) {
  const { storage, currentVersion } = dependencies;
  const now = dependencies.now ?? Date.now;
  // A newly installed release gets its own first check, even on the same day.
  const lastCheckKey = `appUpdate.lastCheckAt.${currentVersion ?? 'unknown'}`;
  const ignoredVersionKey = 'appUpdate.ignoredVersion';
  const listeners = new Set<() => void>();
  let snapshot: UpdateSnapshot = { status: 'idle', release: null };
  let canPrompt = false;
  let promptOpen = false;
  let pending: ((dismiss: () => void) => void) | null = null;
  let inFlight: Promise<void> | null = null;
  let mode: 'automatic' | 'manual' = 'automatic';

  function publish(next: UpdateSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function flush() {
    if (!canPrompt || promptOpen || !pending) return;
    const show = pending;
    pending = null;
    promptOpen = true;
    let dismissed = false;
    show(() => {
      // Android may deliver both the button callback and onDismiss for one alert.
      if (dismissed) return;
      dismissed = true;
      promptOpen = false;
      flush();
    });
  }

  function message(title: string, body: string) {
    pending = (dismiss) => dependencies.showMessage(title, body, dismiss);
    flush();
  }

  function queueRelease(release: AppRelease) {
    pending = (dismiss) =>
      dependencies.showUpdate(release, {
        later: dismiss,
        ignore: () => {
          storage.set(ignoredVersionKey, release.version);
          dismiss();
        },
        open: () => {
          dismiss();
          void dependencies.openURL(release.url).catch(() => {
            message(
              '无法打开更新页面',
              '请稍后重试，或在浏览器中访问 GitHub 的 NekoFin 版本页面。',
            );
          });
        },
      });
    flush();
  }

  function check(requestMode: 'automatic' | 'manual'): Promise<void> {
    if (promptOpen) return Promise.resolve();
    if (inFlight) {
      if (requestMode === 'manual') mode = 'manual';
      return inFlight;
    }

    if (requestMode === 'automatic') {
      if (!dependencies.automaticEnabled || !canPrompt || !currentVersion) return Promise.resolve();
      const lastCheck = storage.getNumber(lastCheckKey);
      const elapsed = lastCheck === undefined ? Infinity : now() - lastCheck;
      if (elapsed >= 0 && elapsed < UPDATE_CHECK_INTERVAL_MS) return Promise.resolve();
    }

    mode = requestMode;
    pending = null;
    publish({ status: 'checking', release: snapshot.release });
    // Also throttle failed automatic attempts so foreground/network churn stays quiet.
    storage.set(lastCheckKey, now());
    inFlight = Promise.resolve()
      .then(() => {
        if (!currentVersion) throw new Error('无法读取当前应用版本，请使用正式发布的安装包。');
        return dependencies.fetchUpdate();
      })
      .then((release) => {
        publish({ status: release ? 'available' : 'current', release });
        if (release) {
          if (mode === 'manual' || storage.getString(ignoredVersionKey) !== release.version) {
            queueRelease(release);
          }
        } else if (mode === 'manual') {
          message('未发现更新', `当前没有可用的新版本。\n当前版本：v${currentVersion}`);
        }
      })
      .catch((error: unknown) => {
        const description = error instanceof Error ? error.message : '检查更新失败，请稍后重试。';
        publish({ status: 'error', release: null, error: description });
        if (mode === 'manual') message('检查更新失败', description);
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    checkManually: () => check('manual'),
    setCanPrompt(value: boolean) {
      canPrompt = value;
      if (canPrompt) {
        flush();
        void check('automatic');
      }
    },
  };
}
