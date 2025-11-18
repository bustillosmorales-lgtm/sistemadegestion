/**
 * Toast notification utilities using react-hot-toast
 * Provides consistent toast notifications across the app
 */

import toast from 'react-hot-toast'

/**
 * Show success toast
 */
export function showSuccess(message: string) {
  return toast.success(message)
}

/**
 * Show error toast
 */
export function showError(message: string) {
  return toast.error(message)
}

/**
 * Show info toast
 */
export function showInfo(message: string) {
  return toast(message, {
    icon: 'ℹ️',
  })
}

/**
 * Show warning toast
 */
export function showWarning(message: string) {
  return toast(message, {
    icon: '⚠️',
    style: {
      background: '#f59e0b',
      color: '#fff',
    },
  })
}

/**
 * Show loading toast with promise
 */
export function showLoadingPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string
    error: string
  }
) {
  return toast.promise(promise, messages)
}

/**
 * Show confirmation dialog with toast
 * Returns a promise that resolves to true if user confirms
 */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message)
    resolve(confirmed)
  })
}

/**
 * Replace standard alert with toast
 */
export function showAlert(message: string) {
  // Detect if it's an error, warning, or success based on content
  if (message.toLowerCase().includes('error') || message.toLowerCase().includes('❌')) {
    return showError(message)
  } else if (message.toLowerCase().includes('✅') || message.toLowerCase().includes('éxito')) {
    return showSuccess(message)
  } else if (message.toLowerCase().includes('⚠️')) {
    return showWarning(message)
  } else {
    return showInfo(message)
  }
}
