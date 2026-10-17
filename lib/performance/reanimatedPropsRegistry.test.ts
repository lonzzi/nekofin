import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native-reanimated/src/common/style/processors/colors', () => ({
  unprocessColor: (value: unknown) => value,
  unprocessColorsInProps: vi.fn(),
}));
const { ReanimatedModule } = vi.hoisted(() => ({
  ReanimatedModule: {
    getSettledUpdates: vi.fn<
      () => { viewTag: number; styleProps: Record<string, unknown> | null }[]
    >(() => []),
  },
}));
vi.mock('react-native-reanimated/src/ReanimatedModule', () => ({ ReanimatedModule }));

type RegistryView = { _syncStylePropsBackToReact: ReturnType<typeof vi.fn> };
type Collector = {
  viewsMap: Map<number, RegistryView>;
  intervalId: ReturnType<typeof setInterval> | null;
  registerView: (tag: number, view: RegistryView) => void;
  unregisterView: (tag: number) => void;
  unregisterInterval: () => void;
};

// Exercise the shipped upstream collector without type-checking native-only sources.
const collectorSource = 'react-native-reanimated/src/PropsRegistryGarbageCollector';
const { PropsRegistryGarbageCollector: collector } = (await import(collectorSource)) as {
  PropsRegistryGarbageCollector: Collector;
};

function component() {
  return {
    _syncStylePropsBackToReact: vi.fn(),
  } as unknown as Parameters<typeof collector.registerView>[1];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(ReanimatedModule.getSettledUpdates).mockReturnValue([]);
});

afterEach(() => {
  collector.unregisterInterval();
  collector.viewsMap.clear();
  vi.useRealTimers();
});

describe('Reanimated settled animation registry lifecycle', () => {
  it('keeps collecting another live view after duplicate cleanup of a shared native tag', () => {
    const remaining = component();
    collector.registerView(10, component());
    collector.registerView(20, remaining);
    collector.unregisterView(10);
    collector.unregisterView(10);
    vi.mocked(ReanimatedModule.getSettledUpdates).mockReturnValue([
      { viewTag: 20, styleProps: { opacity: 1 } },
    ]);

    vi.advanceTimersByTime(500);

    expect(remaining._syncStylePropsBackToReact).toHaveBeenCalledWith({ opacity: 1 });
  });

  it('restarts collection when a new view mounts after both nested wrappers unmount', () => {
    const shared = component();
    collector.registerView(10, shared);
    collector.registerView(10, shared);
    collector.unregisterView(10);
    collector.unregisterView(10);
    collector.registerView(20, component());

    vi.advanceTimersByTime(500);

    expect(ReanimatedModule.getSettledUpdates).toHaveBeenCalledTimes(1);
  });

  it('uses one collection interval for duplicate registrations', () => {
    const shared = component();
    collector.registerView(10, shared);
    collector.registerView(10, shared);

    vi.advanceTimersByTime(1000);

    expect(ReanimatedModule.getSettledUpdates).toHaveBeenCalledTimes(2);
  });

  it('ignores cleanup of a tag that was never registered', () => {
    collector.registerView(10, component());
    collector.unregisterView(99);

    vi.advanceTimersByTime(500);

    expect(ReanimatedModule.getSettledUpdates).toHaveBeenCalledTimes(1);
  });
});
