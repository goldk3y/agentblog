/**
 * The home page exists so the app has a route before anything is installed.
 *
 * It uses `bg-background` and `text-muted-foreground` rather than a colour
 * literal, which makes it the smallest possible check that `app/globals.css`
 * really did register the shadcn tokens as Tailwind utilities. A build that
 * cannot resolve them is a broken theme, and the pages the registry installs
 * would fail the same way one step later with a much longer error.
 */
export default function Home() {
  return (
    <main className="bg-background min-h-svh p-8">
      <h1 className="text-xl font-bold">fixture-next16</h1>
      <p className="text-muted-foreground mt-2">
        Nothing is installed yet. CI adds the AgentBlog block from the local registry build.
      </p>
    </main>
  )
}
