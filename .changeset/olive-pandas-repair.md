---
'agentblog': minor
---

Make a `src/` layout install build. It did not, on every version until now.

**`create-next-app` asks whether you want your code in a `src/` directory, and
nothing in this repository had ever built a project that said yes.** In that
layout `@/*` maps to `./src/*`, while `agentblog.config.ts` belongs at the
project root and shadcn puts it there, because its `~/` target means the root
literally. The single import in `lib/config.ts` therefore resolved to nothing and
the build stopped before any of our code ran:

```text
Module not found: Can't resolve '@/agentblog.config'
```

Every documented remedy was wrong. `lib/preflight.ts` described this exact
situation and named `doctor --fix` as the cure, which did not implement it and
did not report it either; the guard itself can never print, because module
resolution fails before a module is evaluated. The configuration reference said
fixing a `src/` project was "a one-line change" without ever saying which line.

`agentblog init` and `agentblog doctor --fix` now write that line:

```json title="tsconfig.json"
"paths": {
  "@/agentblog.config": ["./agentblog.config.ts"],
  "@/*": ["./src/*"]
}
```

TypeScript resolves `paths` by the longest prefix before any `*`, so the entry
without a wildcard wins over `@/*` in either order. The repair is gated on
whether the specifier actually resolves rather than on whether `src/` exists, so
a flat layout gets no diff at all and nobody acquires a redundant entry. It edits
the file as text rather than reserialising it, because `tsconfig.json` is JSONC
and a round trip would delete every comment in it.

New check 35 reports the same thing when you run `doctor` without `--fix`, so the
build error now has somewhere to send you. `agentblog revert` undoes the edit
like any other.

**Upgrading:** nothing to do on a flat layout. On a `src/` layout that you had
already fixed by hand, the entry you wrote is left exactly as it is.
