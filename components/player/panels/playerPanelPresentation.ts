import { useEffect, useRef, type ReactNode } from 'react';

export type PlayerPanelHostProps = {
  visible: boolean;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  onBack?: () => void;
  testID?: string;
};

/** Keep the last panel mounted while the native dismissal animation finishes. */
export function usePlayerPanelPresentation({
  visible,
  title,
  children,
  onBack,
}: PlayerPanelHostProps) {
  const last = useRef({ title, children, onBack });
  useEffect(() => {
    if (visible) last.current = { title, children, onBack };
  }, [visible, title, children, onBack]);
  return visible ? { title, children, onBack } : last.current;
}
