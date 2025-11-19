/**
 * useToast Hook
 * Wrapper para react-hot-toast compatible con shadcn/ui
 */

import toast from 'react-hot-toast';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  return {
    toast: ({ title, description, variant }: ToastOptions) => {
      const message = description || title || '';

      if (variant === 'destructive') {
        return toast.error(message);
      }

      return toast.success(message);
    },
  };
}
