# fixture-no-shadcn

Tailwind v4 is installed. There is no `components.json`. That is the whole
fixture.

`agentblog init` must refuse here, print the shadcn instruction, and write
nothing at all. `scripts/assert-init-refuses.mjs` runs the command, asserts a
non-zero exit, asserts the instruction appears in the output, and compares a
recursive file listing taken before and after to prove no file was created,
modified, or deleted.

## Why refusing is the correct behaviour

Running `shadcn init` on the user's behalf would pick a component base, set a
`baseColor`, and write CSS variables into their stylesheet. That is choosing a
design system for someone who already has one, and it is the failure that makes
people uninstall rather than restyle. A project with Tailwind already has a
visual identity. See https://docs.agentblog.dev/guides/match-your-design.

The refusal costs one line of output:

> AgentBlog builds on shadcn/ui, and it inherits your theme rather than
> replacing it. Run `npx shadcn@latest init` first, then re-run this command. It
> will ask you to pick a base color and component library. Those are your
> choices, not ours.

## Why "wrote nothing" is asserted rather than assumed

A command that fails after writing half its output is worse than one that
succeeds, because the user is left with a repository in a state neither they nor
we chose. Exit code alone does not catch that. The before and after listing does.

## Do not add `components.json` to this directory

If you need a fixture with shadcn configured, that is `apps/fixture-next16`.
Adding one here would turn the refusal assertion into a test of nothing, and it
would still pass.
