---
'agentblog': minor
---

Rework the agent skills: two new ones, a contract gate, and the end of the
duplication between the skills and the CLI.

**A skill told agents to run a command that does not exist.**
`agentblog-audit` ended on `agentblog audit --schema --links --dates --capsules`.
The audit command has none of those flags and deliberately refuses to grow them,
so the last step of the pre-publish gate exited with a parse error every time
anybody reached it. `scripts/assert-skill-contract.mjs` now extracts every
`agentblog` invocation from every skill and reference file and checks the command
and each flag against the commander definitions in the CLI entry point, so this
cannot recur.

**Two new skills.** `plan-blog-content` builds the layer above a post: the entity
the site should be known for, five to ten category hubs, query clusters mined
from real search phrasing, and a pillar and supporting post per cluster with the
internal link direction settled in advance, written to
`content/editorial-plan.md`. `publish-blog-post` owns the publish gate, where
every step has a silent failure mode: it gates on `audit` and `doctor`, runs
`agentblog ping`, and reports the IndexNow response code rather than the absence
of an error, because `403` for an invalid key and `422` for a host mismatch are
indistinguishable from `200` unless somebody reads the number.

**`agentblog-setup` now finishes the blog rather than the wiring.** The seed
install ships AgentBlog's own author, AgentBlog's own four categories, and two
posts about AI search, so a user who stopped after the config patches had a blog
that passed `doctor` and published somebody else's topics under a placeholder
byline linking to `example.com`. Phase 1 delegates the mechanical repairs to
`doctor --fix`. Phase 2 interviews the user and writes the real author record,
the real taxonomy, and a decision about the seed posts.

**The skills stopped restating the CLI.** `agentblog audit` runs twenty-eight
deterministic checks and `doctor` runs about fifty, and the audit skill and the
pre-publish checklist were narrating most of them as prose for an agent to do by
reading. Both now run the command first and cover only what a script cannot: what
a crawler literally receives, whether the JSON-LD validates against the raw HTML,
whether each cited source actually contains the claim, and whether the prose reads
as written by a person. `references/checklist.md` lost every item the CLI already
answers.

**A voice pass, in `write-blog-post`.** New `references/voice.md` carries the
pattern catalogue, and step 9 is a separate revision pass on purpose: writing
while scanning a list of forbidden patterns produces prose that avoids them and
says nothing. The body gains one hard rule, that inventing experience is banned.
An anecdote or a first-person story added to make prose sound human is
fabrication that also reads as fabrication, and it was the one failure mode the
existing bans did not cover.

**Frontmatter follows the Agent Skills specification.** `when_to_use`, `paths`,
and `model` are gone. Claude Code concatenates `when_to_use` onto `description`
and every other agent ignores it, and the skills CLI lists a skill by
`description` alone, so trigger phrases put there were invisible in the directory
listing. They moved into `description`. Every skill now carries `license`,
`compatibility`, and `metadata`, and the only vendor extensions left are
`argument-hint` and `disable-model-invocation`. The gate enforces the closed list,
along with the 500-line body budget, `name` matching the directory, reference
links resolving one level deep, and a contents block on any reference over a
hundred lines.

`agentblog-audit` and `publish-blog-post` set `disable-model-invocation: true`.
An audit that runs opportunistically is an audit nobody reads, and publishing
submits a URL to an external service.

The registry item writes 76 files now rather than 73.
