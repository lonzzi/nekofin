import { navigateToAppDestination } from '@/components/navigation/appNavigation';
import { useNavigationContainerRef, useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useAppNavigation() {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  return useCallback(
    (destination: string) => navigateToAppDestination(router, destination, navigation),
    [router, navigation],
  );
}
