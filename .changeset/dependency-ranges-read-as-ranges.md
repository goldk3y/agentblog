---
'agentblog': patch
---

Read dependency versions as semver ranges, which unblocks `init` on a stock `create-next-app` project.

`create-next-app` writes `"tailwindcss": "^4"`. The version parser matched a full `x.y.z` only, so `^4` read as absent and `init` refused with "Tailwind CSS is not installed. AgentBlog requires Tailwind v4", pointing at a v3 migration guide the project had no use for. The same gap hid `^16`, `^19`, `~5.1`, and `4.x`, so a Next.js 16 project could be refused for not having Next.js.

Ranges now go through `semver`. An installed version is compared with `satisfies`, and a declared range with `intersects`, so a range is refused only when no version it permits could meet the floor. `"typescript": "^5"` therefore passes the TypeScript 5.1 floor rather than failing on its 5.0.0 minimum.

Three other reporting fixes come with it:

- A package that is absent, and one whose spec names no version (`catalog:`, `workspace:*`, an uninstalled `node_modules`), now get different messages. The second says which install command to run instead of recommending a Tailwind migration.
- When a spec names no version, `init` and `doctor` fall back to shadcn's own marker for a v4 project, the empty `tailwind.config` in `components.json`.
- No message describes a declared range as an installed version, and doctor check 9 skips rather than guessing when it cannot read the installed Next.js from `node_modules`.
