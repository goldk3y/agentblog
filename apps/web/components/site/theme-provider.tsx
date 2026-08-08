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
 * WHY THE OS SETTING IS IGNORED
 * The site is dark by default, so `enableSystem` is off rather than the default
 * `true`. With it on, `defaultTheme` only decides what happens when the OS
 * expresses no preference, which in practice is never: `prefers-color-scheme`
 * resolves to light or dark on every current browser, so a visitor on a light
 * desktop would still land on the light theme. Turning it off makes dark the
 * first paint for everyone. The toggle in the header still writes an explicit
 * `light` or `dark` to `localStorage`, and that choice survives reloads.
 *
 * The blog block ships no theme provider of its own. It reads whatever tokens
 * the host app defines, which is the point.
 * @see https://docs.agentblog.dev/guides/match-your-design
 */
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
