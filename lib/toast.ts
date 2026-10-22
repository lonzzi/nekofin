import * as Burnt from 'burnt';

import type { ToastOptions } from './toast.types';

function show(preset: 'done' | 'error' | 'none', title: string, options?: ToastOptions) {
  return Burnt.toast({
    title,
    message: options?.description,
    preset,
    haptic: 'none',
    duration: preset === 'error' ? 5 : 3,
    from: 'top',
  });
}

// This adapter only maps the API. Burnt's Swift module creates and presents the UI.
export const toast = {
  success: (title: string, options?: ToastOptions) => show('done', title, options),
  error: (title: string, options?: ToastOptions) => show('error', title, options),
  info: (title: string, options?: ToastOptions) => show('none', title, options),
};
