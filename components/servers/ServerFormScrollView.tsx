import PageScrollView from '@/components/PageScrollView';
import type { ComponentProps } from 'react';

export function ServerFormScrollView(props: ComponentProps<typeof PageScrollView>) {
  return <PageScrollView {...props} />;
}
