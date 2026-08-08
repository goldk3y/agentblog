# Voice

The revision pass. Load this after a draft exists, not before: writing while
scanning a list of forbidden patterns produces prose that avoids them and says
nothing.

The goal is not to evade a detector. Detectors are unreliable and optimising for
one produces worse writing, not better. The goal is that a competent reader
finishes the post without once thinking about how it was produced.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository.

## Contents

- How to run the pass
- Empty importance and abstraction
- Stock rhetorical moves
- Mechanical diction
- Rhythm and structure
- Endings
- What not to fake
- The five questions

---

## How to run the pass

Read the draft top to bottom as an editor who did not write it. Mark every place
the eye slides off. Then work the catalogue below against the marks.

Two rules govern the whole pass:

- **Every pattern here is a warning, not a ban.** A construction that carries real
  meaning stays. "It is not a cache, it is a queue" is a real distinction and
  survives. "It is not just fast, it is transformative" is decoration and goes.
- **Do not flatten.** A pass that normalises every paragraph to the same shape
  and polish has replaced one machine signature with another. Leave strong
  sentences alone.

## Empty importance and abstraction

| Pattern              | What it looks like                                                                                                            | Fix                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Importance puffery   | "plays a vital role", "marks a pivotal moment", "underscores the significance of"                                             | State the supported fact. Let the reader decide it matters.                                                  |
| Promotional language | "powerful", "groundbreaking", "cutting-edge", "game-changing"                                                                 | Replace with what the thing measurably does.                                                                 |
| Superficial analysis | a trailing clause that pretends to explain: "highlighting the importance of", "showcasing how", "reflecting the shift toward" | State the mechanism or the consequence, or delete the clause.                                                |
| Weasel attribution   | "studies show", "experts agree", "industry reports suggest", "it is widely believed"                                          | Name the study and link it, or cut the claim. This one is also a citation failure, not only a style failure. |
| Formulaic outlook    | a closing "Despite these challenges" or "Looking ahead" paragraph with no specific content                                    | Keep only concrete problems, plans, and unknowns the post actually establishes.                              |

Weasel attribution is the pattern to hunt hardest, because it is the one that
survives every other check. It reads like evidence and carries none.

## Stock rhetorical moves

| Pattern            | What it looks like                                                                | Fix                                                                               |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Binary contrast    | "It is not X, it is Y", "not only X but Y", "the question is not X, it is Y"      | State the point. Keep only when the contrast is a real distinction.               |
| Throat-clearing    | "Here is the thing", "The truth is", "It is worth noting that", "Let us be clear" | Delete the setup. The next sentence works alone.                                  |
| Faux insight       | "What nobody tells you", "the part everyone misses", "what most people get wrong" | Make the claim stand on its own.                                                  |
| Colon reveal       | "The reason: retrieval.", "The best part: it is free."                            | Write the sentence. Keep the colon for real lists and labels.                     |
| Rhetorical setup   | "What if I told you", "Think about it", a question answered in its own paragraph  | State the point. (Question-format H2 **headings** are required and are not this.) |
| Negative listing   | "Not a tool. Not a feature. A shift."                                             | Say what it is.                                                                   |
| Dramatic fragments | "That is it. That is the whole thing." "And speed. And scale."                    | Join them when the fragments are decoration rather than emphasis.                 |
| Forced trio        | three items chosen for cadence when two carry the meaning                         | Cut the filler item. Lists of any natural length are fine.                        |
| False range        | "from startups to enterprises", "from A to Z" where the endpoints are not a scale | Name the actual cases.                                                            |

## Mechanical diction

- **Banned outright**, because `agentblog audit` fails the post on them: "delve",
  "leverage", "robust", "seamless", "landscape", "tapestry". A legitimate
  technical use of "landscape" almost never appears in a blog post. Rewrite.
- **Fake-strong verbs**: "serves as", "stands as", "boasts", "features", "offers".
  Usually "is" or "has" is clearer, and often a specific verb is better than both.
- **Synonym cycling**: rotating "crawler", "bot", "agent", "system" for one thing
  because repetition feels wrong. Repeat the clearest term. Section 5 of the
  writing procedure requires this anyway, since a retrieved chunk arrives without
  the sentence that established the synonym.
- **Swollen phrases**: "in order to" is "to". "due to the fact that" is "because".
  "has the ability to" is "can". "at this point in time" is "now".
- **Stacked hedging**: "could potentially" is "could". Keep exactly the
  uncertainty the evidence supports, and no layers on top of it.
- **Chatbot residue**: "Of course", "I hope this helps", "Let me know if", a note
  about a knowledge cutoff. None of it belongs in a published post.

## Rhythm and structure

Uniform sentence length is the most reliable signal that nobody read the draft
aloud. Human paragraphs vary because meaning varies: a complicated idea runs
long, and the sentence that lands the point is short.

Do not alternate lengths mechanically. That produces a different pattern, not an
absence of one. Instead:

- Read each paragraph aloud in your head. Where you run out of breath, split.
  Where three sentences in a row have the same shape, rewrite the middle one.
- End a section on its shortest sentence when the section has a point to land.
- Keep fragments and long sentences that carry voice. Fix the ones that are
  accidents.

Structure carries the same risk. If every H2 section opens with a capsule, then a
definition, then an example, then a caveat, the post reads as generated even when
every sentence is fine. The capsule is required. Everything after it should follow
the material.

## Endings

- **No fake-profound closer.** A final metaphor or aphorism that inflates the
  preceding point is the single most common tell in a post that is otherwise good.
- **No summary recap.** "In conclusion" and a paragraph repeating what the reader
  just read. Cut it.
- End on the strongest concrete thing the post established: the number, the
  finding, or the next action. If the post has an FAQ, the FAQ is the ending.

## What not to fake

The failure mode of trying to write like a person is inventing a person.

Never manufacture any of the following to make prose sound human:

- A personal anecdote, a first-person experience, or a story about "a client we
  worked with".
- An opinion, a preference, or a reaction the source material does not support.
- Humour, self-deprecation, or an aside about the writing process.
- A specific detail added for texture. "On a Tuesday in March" is a fabrication
  when nothing establishes the date.

A post can be direct, concrete, and confident without any of that. The
credibility this product sells comes from verified evidence and a named author
with a real bio, not from a voice pretending to have lived something.

If the user supplies real experience, use it, and attribute it to them.

## The five questions

Run these against the finished draft. A "no" is a revision, not a note.

1. Does every claim, number, quotation, and source come from something actually
   fetched, and is every one of them in `citations[]`?
2. Would the named author recognise this as their own writing?
3. Does each paragraph carry information, reasoning, or necessary transition, and
   would deleting it lose something?
4. Read aloud, does any run of three sentences share a shape?
5. Does the post end on a fact rather than on a flourish?
