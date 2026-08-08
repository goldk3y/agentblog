/**
 * The shadcn `cn` helper.
 *
 * `clsx` resolves conditional class expressions; `twMerge` then drops earlier
 * Tailwind utilities that a later one contradicts, so a caller can always
 * override a component's defaults by passing `className` last. Without the merge
 * step, `<Button className="bg-card" />` emits two competing background
 * utilities and the winner is whichever rule Tailwind happened to output later,
 * which is not something a caller can reason about.
 *
 * This file lives at `apps/web/lib/utils.ts` rather than in the registry source
 * on purpose. `components.json` aliases `utils` to `@/lib/utils`, and a consumer
 * already has their own copy from `shadcn init`. Shipping ours would overwrite
 * theirs, which is the inheritance failure the block exists to avoid.
 * @see https://docs.agentblog.dev/guides/match-your-design
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
