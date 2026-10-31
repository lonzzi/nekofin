import { useScreenTransitionReady } from '@/hooks/useScreenTransitionReady';
import { scheduleAfterNavigation } from '@/lib/navigationWork';
import {
  Children,
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';

const DetailSectionsReady = createContext(true);

/** Observe the opening transition even while detail data is still loading. */
export function DetailSectionsProvider({ children }: PropsWithChildren) {
  if (Platform.OS === 'web') return <>{children}</>;
  return <NativeDetailSectionsProvider>{children}</NativeDetailSectionsProvider>;
}

function NativeDetailSectionsProvider({ children }: PropsWithChildren) {
  const ready = useScreenTransitionReady();
  return <DetailSectionsReady value={ready}>{children}</DetailSectionsReady>;
}

/** Keep native opening transitions free of secondary lists and media tables. */
export function DeferredDetailSections({ children }: PropsWithChildren) {
  if (Platform.OS === 'web') return <>{children}</>;
  return <NativeDetailSections>{children}</NativeDetailSections>;
}

function NativeDetailSections({ children }: PropsWithChildren) {
  const ready = useContext(DetailSectionsReady);
  const [visibleCount, setVisibleCount] = useState(0);
  const sections = Children.toArray(children);

  useEffect(() => {
    if (!ready || visibleCount >= sections.length) return;
    // Mount one section per idle turn rather than moving the same large batch
    // from the opening animation onto its final frame.
    const task = scheduleAfterNavigation(() => setVisibleCount((count) => count + 1));
    return () => task.cancel();
  }, [ready, sections.length, visibleCount]);

  return <>{sections.slice(0, visibleCount)}</>;
}
