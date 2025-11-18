/**
 * Confirmation Dialog Component
 * Replaces window.confirm() with a better UX
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hook to manage confirmation dialogs
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<Omit<ConfirmDialogProps, 'isOpen' | 'onClose'>>({
    onConfirm: () => {},
    title: '',
    description: '',
  })

  const confirm = (newConfig: Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'> & { onConfirm: () => void }) => {
    setConfig(newConfig)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
  }

  return {
    isOpen,
    confirm,
    close,
    config,
  }
}
