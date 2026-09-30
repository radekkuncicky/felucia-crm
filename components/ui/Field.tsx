'use client'

import { createContext, forwardRef, useContext, useId } from 'react'
import { cn } from '@/lib/cn'

interface FieldCtx {
  id: string
  describedBy?: string
  invalid: boolean
  required: boolean
}

const FieldContext = createContext<FieldCtx | null>(null)

export interface FieldProps {
  label: React.ReactNode
  /** Nápověda pod polem */
  hint?: React.ReactNode
  /** Chybová hláška u pole (nahradí nápovědu) */
  error?: string | null
  required?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Popisek + pole + nápověda/chyba. Propojí label s polem (htmlFor/id) a
 * nastaví aria-invalid/aria-describedby — Input/Select/Textarea uvnitř si
 * id vezmou z kontextu.
 */
export function Field({ label, hint, error, required = false, className, children }: FieldProps) {
  const id = useId()
  const msgId = `${id}-msg`
  const msg = error || hint
  return (
    <FieldContext.Provider value={{ id, describedBy: msg ? msgId : undefined, invalid: !!error, required }}>
      <div className={className}>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
        </label>
        {children}
        {msg && (
          <p id={msgId} className={cn('text-xs mt-1', error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400')}>
            {msg}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

const CONTROL = 'w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed'

function controlClasses(invalid: boolean, className?: string) {
  return cn(
    CONTROL,
    invalid
      ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
      : 'border-gray-300 dark:border-slate-600 focus:ring-primary',
    className,
  )
}

function useFieldProps(props: Pick<React.AriaAttributes, 'aria-describedby' | 'aria-invalid'> & { id?: string; required?: boolean }) {
  const ctx = useContext(FieldContext)
  return {
    id: props.id ?? ctx?.id,
    required: props.required ?? ctx?.required,
    'aria-describedby': props['aria-describedby'] ?? ctx?.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (ctx?.invalid || undefined),
    invalid: !!ctx?.invalid,
  }
}

/** Druh pole → správná klávesnice na mobilu a automatické vyplňování */
export type InputKind = 'text' | 'email' | 'tel' | 'psc' | 'ico' | 'castka' | 'cislo'

const KIND: Record<InputKind, React.InputHTMLAttributes<HTMLInputElement>> = {
  text: {},
  email: { type: 'email', inputMode: 'email', autoComplete: 'email' },
  tel: { type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
  psc: { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 6 },
  ico: { inputMode: 'numeric', maxLength: 8 },
  castka: { inputMode: 'decimal' },
  cislo: { inputMode: 'numeric' },
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  kind?: InputKind
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ kind = 'text', className, ...rest }, ref) {
  const { invalid, ...field } = useFieldProps(rest)
  return <input ref={ref} {...KIND[kind]} {...rest} {...field} className={controlClasses(invalid, className)} />
})

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  const { invalid, ...field } = useFieldProps(rest)
  return <select ref={ref} {...rest} {...field} className={controlClasses(invalid, className)} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  const { invalid, ...field } = useFieldProps(rest)
  return <textarea ref={ref} {...rest} {...field} className={controlClasses(invalid, className)} />
})
