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

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // nonce: inline skript next-themes (proti probliknutí tématu) by jinak zablokovala CSP
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
      <SessionProvider>
        {children}
        <ThemedToaster />
        <ConfirmHost />
      </SessionProvider>
    </ThemeProvider>
  )
}
