# AgentBlog Claude Code plugin

The plugin distribution of the AgentBlog agent layer. Same skills as the registry
install, different delivery: this one does not touch the consumer's Next.js app.

```
/plugin marketplace add agentblog/agentblog
/plugin install agentblog@agentblog
```

## `skills/` is generated. Do not edit it.

The source of truth for every skill is `apps/web/registry/agent/skills/**` in the
repository root. `scripts/codegen.mjs` copies that tree verbatim into
`plugins/agentblog/skills/**`, and CI runs `pnpm codegen && git diff --exit-code`,
so an edit made here is either overwritten or fails the build.

To change a skill, edit the file under `apps/web/registry/agent/skills/` and run
`pnpm codegen`.

### Why a copy and not a symlink

A symlink from `plugins/agentblog/skills/` to `apps/web/registry/agent/skills/`
would work locally and ship nothing.

When a user installs a plugin, Claude Code copies the plugin directory to a cache
location. Files outside that directory are not copied, so a symlink pointing out of
the plugin directory resolves to nothing on the installed copy. Local development
would look correct and every installed plugin would ship empty skills. That failure
is invisible to us and visible only to users, which is the worst shape a failure can
have.

The copy is boring and it is verifiable in CI. That is the entire argument.

## Skill names differ between the two install paths

The same skill is invoked differently depending on how it was installed:

| Install path                                                              | Command                      |
| ------------------------------------------------------------------------- | ---------------------------- |
| Registry (`shadcn add`, writes `.claude/skills/write-blog-post/SKILL.md`) | `/write-blog-post`           |
| This plugin                                                               | `/agentblog:write-blog-post` |

For a project skill the invocable name comes from the **directory** name, and
frontmatter `name` is only a display label. For a plugin skill, frontmatter `name`
sets the last segment and the plugin prefix stays in place.

Nothing we ship should hardcode either form. `AGENTS.agentblog.md` refers to skills
by name rather than by slash command for exactly this reason: an agent resolves a
skill from its name regardless of install path.

## Plugin `name` is expensive to change

`agentblog` is the stable identifier users reference in `enabledPlugins`,
`pluginConfigs`, and `/plugin install`. Changing it breaks existing installs.

A rename is technically survivable: a top-level `renames` map in `marketplace.json`
migrates existing users, and Claude Code follows rename chains. It requires Claude
Code v2.1.193 or later, so a rename strands older clients regardless. Treat `renames`
as append-only history if it ever becomes necessary, and use `displayName` for label
changes instead.

## Versioning

`plugin.json` deliberately omits `version`.

Setting it pins the plugin to that string, so users receive updates only when the
field is bumped. Until a release workflow bumps it automatically, a hardcoded
version means the plugin silently freezes at whatever was published first. Omitting
it makes Claude Code fall back to the git commit SHA, so every push to the default
branch ships.

When the release workflow does own this field, add `version` here and add a CI
assertion that it matches the released tag. Do not add the field without the
assertion.

## CI

- `pnpm codegen && git diff --exit-code` proves `skills/` matches its source.
- `claude plugin validate .` checks the manifest and the marketplace entry, and
  rejects a `renames` chain that cycles or fails to terminate.
