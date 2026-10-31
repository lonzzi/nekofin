import { beforeEach, expect, it, vi } from 'vitest';

import { useNativeSearchHeader } from './useNativeSearchHeader';

type Screen = {
  owner: string;
  focused: boolean;
  refs: { current: unknown }[];
  deps?: readonly unknown[];
  cleanup?: () => void;
};
const state = vi.hoisted(() => ({
  current: null as unknown as Screen,
  refIndex: 0,
  tablet: true,
  owners: new Set<string>(),
  setActive: vi.fn(),
}));

vi.mock('@/components/navigation/TabletChromeContext', () => ({ TabletChromeContext: {} }));
vi.mock('expo-router/react-navigation', () => ({
  useIsFocused: () => state.current.focused,
}));
vi.mock('react', () => ({
  useId: () => state.current.owner,
  useContext: () => (state.tablet ? { setHeaderSearchActive: state.setActive } : null),
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) => {
    const index = state.refIndex++;
    return (state.current.refs[index] ??= { current: initial });
  },
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const previous = state.current.deps;
    if (previous && deps.every((value, index) => Object.is(value, previous[index]))) return;
    state.current.cleanup?.();
    state.current.deps = deps;
    state.current.cleanup = effect();
  },
}));

function screen(owner = 'search'): Screen {
  return { owner, focused: true, refs: [] };
}
function useHeader(current: Screen) {
  state.current = current;
  state.refIndex = 0;
  return useNativeSearchHeader();
}
beforeEach(() => {
  state.tablet = true;
  state.owners = new Set();
  state.setActive.mockReset().mockImplementation((owner: string, active: boolean) => {
    if (active) state.owners.add(owner);
    else state.owners.delete(owner);
  });
});

it('gives the expanded native field the toolbar until it actually closes', () => {
  const current = screen();
  const header = useHeader(current);
  expect(state.owners.size).toBe(0);
  header.onOpen();
  expect(state.owners.has(current.owner)).toBe(true);
  // A query/keyboard update can rerender the page without collapsing SearchView.
  useHeader(current);
  expect(state.owners.has(current.owner)).toBe(true);
  header.onClose();
  expect(state.owners.size).toBe(0);
});

it('releases the toolbar on navigation and reacquires it for a retained search field', () => {
  const current = screen();
  useHeader(current).onOpen();
  current.focused = false;
  useHeader(current);
  expect(state.owners.size).toBe(0);
  current.focused = true;
  useHeader(current);
  expect(state.owners.has(current.owner)).toBe(true);
  current.cleanup?.();
  expect(state.owners.size).toBe(0);
});

it('does not let a background search screen hide the active page navigation', () => {
  const current = screen();
  current.focused = false;
  useHeader(current).onOpen();
  expect(state.owners.size).toBe(0);
});

it('keeps the next search owner active when an older search page unmounts', () => {
  const first = screen('server-search');
  const second = screen('all-search');
  useHeader(first).onOpen();
  useHeader(second).onOpen();
  first.cleanup?.();
  expect([...state.owners]).toEqual(['all-search']);
  second.cleanup?.();
  expect(state.owners.size).toBe(0);
});

it('keeps native search callbacks usable without Android tablet chrome', () => {
  state.tablet = false;
  const header = useHeader(screen());
  header.onOpen();
  header.onClose();
  expect(state.setActive).not.toHaveBeenCalled();
});
