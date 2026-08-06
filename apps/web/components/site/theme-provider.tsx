/**
 * Theme provider for agentblog.dev.
 *
 * WHY `next-themes` RATHER THAN A HAND ROLLED SCRIPT
 * The hard part of dark mode is not the toggle, it is setting the class on
 * `<html>` before the first paint. Anything that runs after hydration produces a
 * white flash on every load for dark-mode users. `next-themes` injects a
 * blocking inline script in the document head that reads `localStorage` and
 * `prefers-color-scheme` and sets the class synchronously, then keeps the choice
 * in sync across tabs and across the OS setting changing while the tab is open.
 * That is roughly forty lines of easy-to-get-wrong script, it is what shadcn's
 * own dark mode guide prescribes, and it costs about 2kB.
 *
 * `attribute="class"` matches the `@custom-variant dark (&:is(.dark *))` rule in
 * `globals.css`. Changing one without the other silently disables dark mode.
 *
 * The blog block ships no theme provider of its own. It reads whatever tokens
 * the host app defines, which is the point of section 4.3.
 */
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
