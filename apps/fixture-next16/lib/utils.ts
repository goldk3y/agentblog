/**
 * The shadcn `cn` helper.
 *
 * `clsx` resolves conditional class expressions; `twMerge` then drops earlier
 * Tailwind utilities that a later one contradicts, so a caller can always
 * override a component's defaults by passing `className` last. Without the merge
 * step, two competing background utilities both survive and the winner is
 * whichever rule Tailwind happened to emit later, which is not something a
 * caller can reason about.
 *
 * This file is committed rather than installed, because that is the real
 * condition. `components.json` aliases `utils` to `@/lib/utils`, and every
 * project that has run `shadcn init` already owns a copy. The registry
 * deliberately does not ship one, so if it ever started shipping one it would
 * overwrite this file and the diff would show up here.
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
