'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'
import { ConfirmHost } from '@/components/ui/confirm'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{ style: { borderRadius: '0.75rem' } }}
    />
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        {children}
        <ThemedToaster />
        <ConfirmHost />
      </SessionProvider>
    </ThemeProvider>
  )
}
