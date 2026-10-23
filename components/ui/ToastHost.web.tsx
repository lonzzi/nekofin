import { useAppTheme } from '@/lib/theme';
import { Toaster } from 'sonner';

export function ToastHost() {
  const theme = useAppTheme();
  return <Toaster theme={theme.colorScheme} position="top-center" duration={5000} richColors />;
}
