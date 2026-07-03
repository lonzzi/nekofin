import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useAppTheme } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HeaderButton } from 'expo-router/react-navigation';

export default function HeaderBackButton({ canGoBack = true }: { canGoBack?: boolean }) {
  const theme = useAppTheme();
  const router = useTracedRouter('header-back');

  if (!canGoBack) {
    return null;
  }

  return (
    <HeaderButton
      onPress={() => router.back()}
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
      }}
    >
      <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
    </HeaderButton>
  );
}
