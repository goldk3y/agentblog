/**
 * The icons a `meta.json` or a page's frontmatter may name.
 *
 * An explicit map rather than `import { icons } from 'lucide-react'`, which is
 * the shape Fumadocs suggests: a dynamic index into that object defeats tree
 * shaking and pulls every icon in the library into the server bundle for the
 * sake of the eight the sidebar uses.
 */
import {
  BookOpen,
  Bot,
  Compass,
  FileText,
  LifeBuoy,
  Rocket,
  Scale,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export const SIDEBAR_ICONS: Record<string, LucideIcon | undefined> = {
  BookOpen,
  Bot,
  Compass,
  FileText,
  LifeBuoy,
  Rocket,
  Scale,
  Wrench,
}
