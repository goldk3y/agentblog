/**
 * Light and dark switch.
 *
 * The button renders identical markup on the server and on the first client
 * pass, and only swaps its icon after mount. `useTheme()` cannot know the
 * resolved theme during SSR, so rendering the "real" icon immediately would
 * either mismatch hydration or force the whole header to be client-only. Both
 * icons are in the DOM at all times and CSS decides which is visible, so there
 * is nothing to hydrate around.
 */
'use client'

import { useTheme } from 'next-themes'

import { Moon, Sun } from '@/components/site/icons'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle between light and dark theme"
      onClick={() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      }}
    >
      <Sun className="size-4 scale-100 rotate-0 transition-transform duration-200 dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-transform duration-200 dark:scale-100 dark:rotate-0" />
    </Button>
  )
}
