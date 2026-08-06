/**
 * A project with Tailwind and its own look, and no shadcn/ui.
 *
 * Nothing here uses a shadcn token, because none exist in this app. That is the
 * condition under test: `agentblog init` must refuse rather than run
 * `shadcn init` and invent a design system for someone who already has one.
 */
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-bold">A Tailwind app that never ran shadcn init</h1>
    </main>
  )
}
