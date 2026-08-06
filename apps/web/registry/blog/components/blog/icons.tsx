/**
 * The single icon import site for the whole AgentBlog block.
 *
 * WHAT THIS IS
 * Every icon rendered by `components/blog/*` and `components/mdx/*` is imported
 * from here, never from `lucide-react` directly.
 *
 * WHY IT IS SHAPED THIS WAY
 * A shadcn `registry:base` item sets `iconLibrary`, so a consumer may be on
 * Tabler, Phosphor, or Radix icons rather than Lucide. AgentBlog installs no
 * base in Mode A (@See https://agentblog.dev/docs/theming.3, rule 3), which means we
 * inherit whatever the project already chose. Routing every icon through one
 * re-export module makes swapping libraries a single-file edit instead of a grep
 * across twelve components, and it is what `shadcn migrate icons` rewrites.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Import an icon straight from `lucide-react` inside a component and you have
 *   silently reintroduced the grep. Add the icon here first.
 * - Rename an export here and every component using it fails to compile, which
 *   is the intended blast radius: loud, immediate, one file.
 *
 * SWAPPING ICON LIBRARIES
 * Replace the import source below and re-map the names. Every export must keep
 * accepting `className` and `aria-hidden`, because callers style icons with
 * `size-*` utilities and mark them decorative. Nothing else is assumed.
 *
 * NOTE ON BRAND ICONS
 * Lucide deprecated its brand glyphs (`Twitter`, `Linkedin`, `Facebook`) and may
 * drop them in a future minor. `share-buttons.tsx` therefore uses text labels
 * plus neutral icons rather than brand marks, so a Lucide upgrade cannot break a
 * consumer's install.
 *
 * @See https://agentblog.dev/docs/theming.3, rule 6
 */
export {
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  BookOpen as BookOpenIcon,
  Check as CheckIcon,
  ChevronDown as ChevronDownIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CircleAlert as CircleAlertIcon,
  CircleCheck as CircleCheckIcon,
  CircleHelp as CircleHelpIcon,
  Clock as ClockIcon,
  Copy as CopyIcon,
  ExternalLink as ExternalLinkIcon,
  Hash as HashIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
  Link2 as LinkIcon,
  List as ListIcon,
  Mail as MailIcon,
  Quote as QuoteIcon,
  Rss as RssIcon,
  Share2 as ShareIcon,
  Tag as TagIcon,
  TriangleAlert as TriangleAlertIcon,
  User as UserIcon,
} from 'lucide-react'
