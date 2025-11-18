/**
 * Centralized error handling utilities
 * Provides consistent error messages and logging
 */

import { ERROR_MESSAGES } from '@/lib/constants'

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Handles API errors and returns user-friendly messages
 */
export function handleApiError(error: any, context: string): string {
  console.error(`Error in ${context}:`, error)

  // Handle network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR
  }

  // Handle 401 Unauthorized
  if (error.message?.includes('401') || error.statusCode === 401) {
    return ERROR_MESSAGES.UNAUTHORIZED
  }

  // Handle session expired
  if (error.message?.includes('session') || error.message?.includes('token')) {
    return ERROR_MESSAGES.SESSION_EXPIRED
  }

  // Handle custom AppError
  if (error instanceof AppError) {
    return error.message
  }

  // Return specific error message if available
  if (error.message) {
    return error.message
  }

  // Fallback to unknown error
  return `${ERROR_MESSAGES.UNKNOWN_ERROR} (${context})`
}

/**
 * Logs errors with additional context
 */
export function logError(
  error: any,
  context: string,
  additionalInfo?: Record<string, any>
) {
  const errorInfo = {
    context,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  }

  console.error('Application Error:', errorInfo)

  // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
}

/**
 * Wraps async functions with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      logError(error, context, { args })
      throw error
    }
  }) as T
}

/**
 * Safely parses error responses
 */
export function parseErrorResponse(response: any): string {
  if (typeof response === 'string') {
    return response
  }

  if (response?.error) {
    return response.error
  }

  if (response?.message) {
    return response.message
  }

  return ERROR_MESSAGES.UNKNOWN_ERROR
}

/**
 * Creates a user-friendly error message for display
 */
export function formatErrorForUser(error: any, action: string): string {
  const message = handleApiError(error, action)
  return message
}

/**
 * Checks if an error is a specific type
 */
export function isAuthError(error: any): boolean {
  return (
    error.message?.includes('401') ||
    error.message?.includes('unauthorized') ||
    error.statusCode === 401
  )
}

export function isNetworkError(error: any): boolean {
  return (
    error instanceof TypeError &&
    error.message.includes('fetch')
  )
}

export function isValidationError(error: any): boolean {
  return (
    error.statusCode === 400 ||
    error.message?.includes('validation') ||
    error.code === 'VALIDATION_ERROR'
  )
}
