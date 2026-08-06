# Changesets

Two packages are published from this workspace:

- **`agentblog`**, the CLI. This is what a user installs.
- **`@agentblog/schema`**, the domain contract. It is published because writing a
  content source adapter means running `runSourceContractTests` from
  `@agentblog/schema/contract`, and an adapter author outside this repository
  cannot do that against a workspace package.

Everything else is an app, a test fixture, or a package that exists only to be
bundled or code-generated into one of those two.

Add a changeset in the same pull request as any user-visible change:

```bash
pnpm changeset
```

Pick the package or packages the change affects, choose a bump, and describe it
the way a user would read it in a release note rather than the way a reviewer
reads a diff. A change to `@agentblog/schema` that alters the `ContentSource`
interface is a breaking change for every adapter anyone has written, so bump it
accordingly and say what an adapter author has to do.

`ignore` in `config.json` lists the workspace members that are deliberately
never published, including `@agentblog/checks`. The CLI inlines that package and
the shipped block receives it by codegen, so publishing it separately would put
three copies of the same predicates into the world and invite them to disagree.
`@agentblog/schema` is inlined into the CLI too, but it is still published,
because it is the contract an external adapter author has to compile against.
