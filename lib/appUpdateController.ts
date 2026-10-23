import { t as tr } from '@/lib/i18n';
import { gt } from 'semver';

import type { AppRelease, InstallerDownload } from './appUpdates';

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
  resourceStatus:
    | 'unavailable'
    | 'idle'
    | 'checking'
    | 'available'
    | 'current'
    | 'downloading'
    | 'ready'
    | 'applying'
    | 'error';
  resourceError?: string;
  downloadStatus: 'idle' | 'downloading' | 'ready' | 'installing' | 'error';
  downloadProgress?: number;
  downloadError?: string;
  downloadWaiting?: string;
  autoDownloadEnabled: boolean;
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
  resources?: {
    check: () => Promise<boolean>;
    download: () => Promise<boolean>;
    apply: () => Promise<void>;
  };
  installer?: {
    start: (release: AppRelease, automatic: boolean) => Promise<InstallerDownload>;
    refresh: () => Promise<InstallerDownload | null>;
    cancel: () => Promise<void>;
    install: (uri: string) => Promise<'opened' | 'permission-required'>;
  };
  autoDownloadEnabled?: boolean;
  canAutoDownloadResources?: () => Promise<boolean>;
  showResourceUpdate?: (download: () => void, dismiss: () => void) => void;
  showReady?: (kind: 'package' | 'resources', install: () => void, dismiss: () => void) => void;
  now?: () => number;
};

export function createAppUpdateController(dependencies: Dependencies) {
  const { storage, currentVersion } = dependencies;
  const now = dependencies.now ?? Date.now;
  // A newly installed release gets its own first check, even on the same day.
  const lastCheckKey = `appUpdate.lastCheckAt.${currentVersion ?? 'unknown'}`;
  const ignoredVersionKey = 'appUpdate.ignoredVersion';
  const listeners = new Set<() => void>();
  let snapshot: UpdateSnapshot = {
    status: 'idle',
    release: null,
    resourceStatus: dependencies.resources ? 'idle' : 'unavailable',
    downloadStatus: 'idle',
    autoDownloadEnabled: dependencies.autoDownloadEnabled ?? false,
  };
  let canPrompt = false;
  let promptOpen = false;
  let pending: ((dismiss: () => void) => void) | null = null;
  let inFlight: Promise<void> | null = null;
  let mode: 'automatic' | 'manual' = 'automatic';
  let operation: Promise<void> | null = null;
  let refreshing: Promise<void> | null = null;
  let downloadAutomatic = false;
  let downloadRevision = 0;
  const autoAttempted = new Set<string>();
  const promptedReady = new Set<string>();
  let autoDecision: Promise<void> | null = null;
  let installerUri: string | null = null;

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

  function queueReady(kind: 'package' | 'resources') {
    if (!dependencies.showReady) return;
    const key = kind === 'package' ? snapshot.release?.tag : 'resources';
    if (!key || promptedReady.has(key)) return;
    pending = (dismiss) => {
      if (
        (kind === 'package' && snapshot.downloadStatus !== 'ready') ||
        (kind === 'resources' && snapshot.resourceStatus !== 'ready')
      ) {
        dismiss();
        return;
      }
      promptedReady.add(key);
      dependencies.showReady!(
        kind,
        () => {
          dismiss();
          void (kind === 'package' ? installPackage() : applyResources());
        },
        dismiss,
      );
    };
    flush();
  }

  function acceptDownload(download: InstallerDownload | null) {
    if (!download) return;
    if (download.automatic && !snapshot.autoDownloadEnabled && download.status === 'downloading') {
      void cancelDownload().catch(() => {});
      return;
    }
    if (currentVersion && !gt(download.release.version, currentVersion)) {
      void dependencies.installer?.cancel().catch(() => {});
      return;
    }
    downloadAutomatic = download.automatic;
    if (download.automatic) autoAttempted.add(download.release.tag);
    installerUri = download.uri ?? null;
    const changed =
      snapshot.release?.tag !== download.release.tag ||
      snapshot.downloadStatus !== download.status ||
      snapshot.downloadProgress !== download.progress ||
      snapshot.downloadWaiting !== download.waiting ||
      snapshot.downloadError !== download.error;
    if (changed)
      publish({
        ...snapshot,
        release: download.release,
        status: 'available',
        downloadStatus: download.status,
        downloadProgress: download.progress,
        downloadWaiting: download.waiting,
        downloadError: download.error,
      });
    if (download.status === 'ready') queueReady('package');
  }

  function refreshDownload(): Promise<void> {
    if (!dependencies.installer) {
      maybeAutoDownload();
      return Promise.resolve();
    }
    if (refreshing) return refreshing;
    if (operation) return operation;
    refreshing = dependencies.installer
      .refresh()
      .then(acceptDownload)
      .catch(() => {
        // An unavailable system service must not interrupt playback or erase a known download.
      })
      .finally(() => {
        refreshing = null;
        maybeAutoDownload();
      });
    return refreshing;
  }

  function downloadPackage(automatic = false): Promise<void> {
    if (operation || inFlight || refreshing) return operation ?? inFlight ?? refreshing!;
    const release = snapshot.release;
    if (!release || snapshot.downloadStatus === 'downloading') return Promise.resolve();
    if (snapshot.downloadStatus === 'ready') {
      queueReady('package');
      return Promise.resolve();
    }
    if (!dependencies.installer) {
      return dependencies.openURL(release.url).then(
        () => {},
        () => {
          message(tr('updates.openUpdatePageFailed'), tr('updates.retryOrCheckGithub'));
        },
      );
    }
    if (automatic) autoAttempted.add(release.tag);
    downloadAutomatic = automatic;
    const revision = ++downloadRevision;
    publish({
      ...snapshot,
      downloadStatus: 'downloading',
      downloadProgress: 0,
      downloadError: undefined,
      downloadWaiting: undefined,
    });
    operation = Promise.resolve()
      .then(() => dependencies.installer!.start(release, automatic))
      .then((download) => {
        if (revision === downloadRevision) acceptDownload(download);
      })
      .catch((error: unknown) => {
        if (revision !== downloadRevision) return;
        const description =
          error instanceof Error ? error.message : tr('updates.startDownloadFailed');
        publish({ ...snapshot, downloadStatus: 'error', downloadError: description });
        if (!automatic) message(tr('updates.downloadFailed'), description);
      })
      .finally(() => {
        operation = null;
      });
    return operation;
  }

  async function cancelDownload() {
    if (!dependencies.installer) return;
    const revision = ++downloadRevision;
    if (snapshot.release) autoAttempted.add(snapshot.release.tag);
    if (operation) await operation;
    await dependencies.installer.cancel();
    if (revision !== downloadRevision) return;
    installerUri = null;
    publish({
      ...snapshot,
      downloadStatus: 'idle',
      downloadProgress: undefined,
      downloadWaiting: undefined,
      downloadError: undefined,
    });
  }

  function maybeAutoDownload() {
    if (!snapshot.autoDownloadEnabled || !canPrompt || inFlight || operation || refreshing) return;
    const release = snapshot.release;
    if (release && dependencies.installer) {
      if (
        snapshot.downloadStatus === 'idle' &&
        !autoAttempted.has(release.tag) &&
        storage.getString(ignoredVersionKey) !== release.version
      ) {
        void downloadPackage(true);
      }
    } else if (snapshot.resourceStatus === 'available' && !autoDecision) {
      autoDecision = (dependencies.canAutoDownloadResources?.() ?? Promise.resolve(true))
        .then((allowed) => {
          if (
            allowed &&
            canPrompt &&
            snapshot.autoDownloadEnabled &&
            snapshot.resourceStatus === 'available' &&
            !operation &&
            !inFlight
          )
            void downloadResources(true);
        })
        .catch(() => {})
        .finally(() => {
          autoDecision = null;
        });
    }
  }

  function installPackage(): Promise<void> {
    if (!canPrompt || operation || !dependencies.installer || !installerUri)
      return operation ?? Promise.resolve();
    const uri = installerUri;
    publish({ ...snapshot, downloadStatus: 'installing', downloadError: undefined });
    operation = Promise.resolve()
      .then(() => dependencies.installer!.install(uri))
      .then((result) => {
        publish({ ...snapshot, downloadStatus: 'ready' });
        if (result === 'permission-required') {
          message(tr('updates.allowInstallation'), tr('updates.installPermissionDescription'));
        }
      })
      .catch((error: unknown) => {
        const description =
          error instanceof Error ? error.message : tr('updates.startInstallationFailed');
        // A cache cleanup may have removed the file. Retrying downloads and verifies it again.
        installerUri = null;
        publish({ ...snapshot, downloadStatus: 'error', downloadError: description });
        message(tr('updates.installationNotStarted'), description);
      })
      .finally(() => {
        operation = null;
      });
    return operation;
  }

  function downloadResources(automatic = false): Promise<void> {
    if (operation || inFlight || !dependencies.resources)
      return operation ?? inFlight ?? Promise.resolve();
    if (snapshot.resourceStatus === 'ready') {
      promptedReady.delete('resources');
      queueReady('resources');
      return Promise.resolve();
    }
    publish({ ...snapshot, resourceStatus: 'downloading', resourceError: undefined });
    operation = Promise.resolve()
      .then(() => dependencies.resources!.download())
      .then((ready) => {
        publish({ ...snapshot, resourceStatus: ready ? 'ready' : 'current' });
        if (ready) queueReady('resources');
        else if (!automatic)
          message(tr('updates.noResourceUpdate'), tr('updates.resourcesUpToDateDescription'));
      })
      .catch((error: unknown) => {
        const description =
          error instanceof Error ? error.message : tr('updates.resourceDownloadFailed');
        publish({ ...snapshot, resourceStatus: 'error', resourceError: description });
        if (!automatic) message(tr('updates.resourceUpdateFailed'), description);
      })
      .finally(() => {
        operation = null;
      });
    return operation;
  }

  function applyResources(): Promise<void> {
    if (!canPrompt || operation || !dependencies.resources || snapshot.resourceStatus !== 'ready')
      return operation ?? Promise.resolve();
    publish({ ...snapshot, resourceStatus: 'applying' });
    operation = Promise.resolve()
      .then(() => dependencies.resources!.apply())
      .catch(() => {
        publish({
          ...snapshot,
          resourceStatus: 'ready',
          resourceError: tr('common.reloadFailed'),
        });
        message(tr('updates.notReadyToApply'), tr('updates.downloadedReloadLater'));
      })
      .finally(() => {
        operation = null;
      });
    return operation;
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
          if (snapshot.downloadStatus === 'ready') {
            promptedReady.delete(release.tag);
            queueReady('package');
          } else void downloadPackage();
        },
      });
    flush();
  }

  function check(requestMode: 'automatic' | 'manual'): Promise<void> {
    if (operation || snapshot.downloadStatus === 'downloading')
      return operation ?? Promise.resolve();
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
    const checkResources = dependencies.resources;
    const resourceWasReady = snapshot.resourceStatus === 'ready';
    publish({
      ...snapshot,
      status: 'checking',
      error: undefined,
      resourceStatus: checkResources ? 'checking' : snapshot.resourceStatus,
      resourceError: checkResources ? undefined : snapshot.resourceError,
    });
    // Also throttle failed automatic attempts so foreground/network churn stays quiet.
    storage.set(lastCheckKey, now());
    inFlight = Promise.allSettled([
      Promise.resolve().then(() => {
        if (!currentVersion) throw new Error(tr('updates.appVersionUnreadable'));
        return dependencies.fetchUpdate();
      }),
      checkResources
        ? Promise.resolve().then(() => dependencies.resources!.check())
        : Promise.resolve(null),
    ])
      .then(([packageResult, resourceResult]) => {
        const fetchedRelease = packageResult.status === 'fulfilled' ? packageResult.value : null;
        // A failed refresh must not hide an installer the user already downloaded.
        const release =
          packageResult.status === 'fulfilled' ? packageResult.value : snapshot.release;
        const error =
          packageResult.status === 'rejected'
            ? packageResult.reason instanceof Error
              ? packageResult.reason.message
              : tr('updates.appCheckFailed')
            : undefined;
        const resourceError =
          resourceResult.status === 'rejected'
            ? resourceResult.reason instanceof Error
              ? resourceResult.reason.message
              : tr('updates.resourceCheckFailed')
            : undefined;
        const resourceAvailable =
          resourceWasReady ||
          (resourceResult.status === 'fulfilled' && resourceResult.value === true);
        const sameRelease = snapshot.release?.tag === release?.tag;
        if (!sameRelease) installerUri = null;
        publish({
          ...snapshot,
          status:
            fetchedRelease || resourceAvailable
              ? 'available'
              : error || resourceError
                ? 'error'
                : 'current',
          release,
          error,
          resourceStatus: checkResources
            ? resourceWasReady
              ? 'ready'
              : resourceError
                ? 'error'
                : resourceAvailable
                  ? 'available'
                  : 'current'
            : snapshot.resourceStatus,
          resourceError: checkResources ? resourceError : snapshot.resourceError,
          downloadStatus: sameRelease ? snapshot.downloadStatus : 'idle',
          downloadError: sameRelease ? snapshot.downloadError : undefined,
        });
        const autoPackage = snapshot.autoDownloadEnabled && !!dependencies.installer;
        if (fetchedRelease && !autoPackage && snapshot.downloadStatus !== 'ready') {
          if (
            mode === 'manual' ||
            storage.getString(ignoredVersionKey) !== fetchedRelease.version
          ) {
            queueRelease(fetchedRelease);
          }
        } else if (
          mode === 'manual' &&
          resourceAvailable &&
          !snapshot.autoDownloadEnabled &&
          dependencies.showResourceUpdate
        ) {
          pending = (dismiss) =>
            dependencies.showResourceUpdate!(() => {
              dismiss();
              void downloadResources();
            }, dismiss);
          flush();
        } else if (mode === 'manual' && !fetchedRelease && !resourceAvailable) {
          if (error || resourceError) {
            message(
              tr('updates.checkIncomplete'),
              [
                error && tr('updates.appError', { error: error }),
                resourceError && tr('updates.resourceError', { resourceError: resourceError }),
              ]
                .filter(Boolean)
                .join('\n'),
            );
          } else {
            message(
              tr('updates.noUpdates'),
              tr('updates.noNewVersionDescription', {
                currentVersion: currentVersion,
                value: !dependencies.resources ? tr('updates.resourceUpdatesUnsupportedNote') : '',
              }),
            );
          }
        }
      })
      .finally(() => {
        inFlight = null;
        maybeAutoDownload();
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
    downloadRelease: () => downloadPackage(),
    installRelease: installPackage,
    downloadResources: () => downloadResources(),
    cancelDownload,
    refreshDownload,
    setAutoDownloadEnabled(value: boolean) {
      publish({ ...snapshot, autoDownloadEnabled: value });
      if (!value && downloadAutomatic && snapshot.downloadStatus === 'downloading')
        void cancelDownload().catch(() => {});
      else maybeAutoDownload();
    },
    setCanPrompt(value: boolean) {
      canPrompt = value;
      if (canPrompt) {
        flush();
        maybeAutoDownload();
        void check('automatic');
      }
    },
  };
}
