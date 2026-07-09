import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle } from 'lucide-react'
import * as React from 'react'

type ToastVariant = 'success' | 'error'
type ToastItem = { id: number; message: string; variant: ToastVariant }

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = nextId++
      setItems((prev) => [...prev, { id, message, variant }])
      window.setTimeout(() => remove(id), 4000)
    },
    [remove],
  )

  const value = React.useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => remove(t.id)}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-md border bg-card px-4 py-3 text-left text-sm text-card-foreground shadow-lg',
              t.variant === 'error' ? 'border-destructive/50' : 'border-border',
            )}
          >
            {t.variant === 'error' ? (
              <XCircle className="text-destructive" />
            ) : (
              <CheckCircle2 className="text-primary" />
            )}
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
