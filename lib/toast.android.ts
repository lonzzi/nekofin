import { Alert, ToastAndroid } from 'react-native';

import type { ToastOptions } from './toast.types';

function show(title: string, options?: ToastOptions, error = false) {
  // System Toasts only allow two lines. Keep structured error details in a native alert.
  if (error && options?.description) {
    Alert.alert(title, options.description);
    return;
  }
  const text = options?.description ? `${title}\n${options.description}` : title;
  ToastAndroid.show(text, error ? ToastAndroid.LONG : ToastAndroid.SHORT);
}

export const toast = {
  success: (title: string, options?: ToastOptions) => show(title, options),
  error: (title: string, options?: ToastOptions) => show(title, options, true),
  info: (title: string, options?: ToastOptions) => show(title, options),
};
