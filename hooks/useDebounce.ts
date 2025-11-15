import { useState, useEffect } from 'react'

/**
 * Hook para debouncing de valores
 * Evita queries excesivas esperando a que el usuario termine de escribir
 *
 * @param value - Valor a debounce (ej: search term)
 * @param delay - Delay en ms (default: 300ms)
 * @returns Valor debounced
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set timeout para actualizar el valor después del delay
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cleanup: cancelar timeout si value cambia antes de que se cumpla el delay
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
