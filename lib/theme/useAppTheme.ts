import { useContext } from 'react';

import { OuterThemeContext, useOuterTheme } from './OuterTheme';

export function useAppTheme() {
  const override = useContext(OuterThemeContext);
  const theme = useOuterTheme();
  return override ?? theme;
}
