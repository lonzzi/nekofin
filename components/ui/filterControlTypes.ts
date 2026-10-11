import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type FilterRowProps = PropsWithChildren<{
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}>;

export type FilterChoiceProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export type FilterButtonProps = {
  label: string;
  title?: string;
  options: { label: string; value?: string; active?: boolean }[];
  onSelect: (value?: string) => void;
};
