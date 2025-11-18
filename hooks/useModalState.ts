/**
 * useModalState Hook
 * Manages modal open/close state with callbacks
 */

import { useState, useCallback } from 'react'

interface UseModalStateOptions {
  /** Callback when modal opens */
  onOpen?: () => void
  /** Callback when modal closes */
  onClose?: () => void
  /** Initial open state */
  initialOpen?: boolean
}

interface UseModalStateReturn {
  /** Whether modal is open */
  isOpen: boolean
  /** Open the modal */
  open: () => void
  /** Close the modal */
  close: () => void
  /** Toggle modal state */
  toggle: () => void
  /** Set modal state directly */
  setIsOpen: (open: boolean) => void
}

/**
 * Hook for managing modal state
 *
 * @example
 * const modal = useModalState()
 *
 * return (
 *   <>
 *     <button onClick={modal.open}>Open</button>
 *     <Modal isOpen={modal.isOpen} onClose={modal.close}>
 *       Content
 *     </Modal>
 *   </>
 * )
 */
export function useModalState(
  options: UseModalStateOptions = {}
): UseModalStateReturn {
  const { onOpen, onClose, initialOpen = false } = options
  const [isOpen, setIsOpen] = useState(initialOpen)

  const open = useCallback(() => {
    setIsOpen(true)
    if (onOpen) {
      onOpen()
    }
  }, [onOpen])

  const close = useCallback(() => {
    setIsOpen(false)
    if (onClose) {
      onClose()
    }
  }, [onClose])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  }
}

/**
 * Hook for managing modal state with data payload
 * Useful for edit modals that need to pass data
 *
 * @example
 * const editModal = useModalWithData<Cotizacion>()
 *
 * const handleEdit = (cotizacion: Cotizacion) => {
 *   editModal.openWith(cotizacion)
 * }
 *
 * return (
 *   <EditModal
 *     isOpen={editModal.isOpen}
 *     data={editModal.data}
 *     onClose={editModal.close}
 *   />
 * )
 */
export function useModalWithData<T>(
  options: UseModalStateOptions = {}
) {
  const { onOpen, onClose, initialOpen = false } = options
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [data, setData] = useState<T | null>(null)

  const openWith = useCallback(
    (payload: T) => {
      setData(payload)
      setIsOpen(true)
      if (onOpen) {
        onOpen()
      }
    },
    [onOpen]
  )

  const close = useCallback(() => {
    setIsOpen(false)
    setData(null)
    if (onClose) {
      onClose()
    }
  }, [onClose])

  return {
    isOpen,
    data,
    openWith,
    close,
    setData,
  }
}
