---
'agentblog': patch
---

Point every documentation link at docs.agentblog.dev.

The documentation moved to its own site, so the URLs the CLI prints and the
`@see` references in the files it installs now name the page they mean rather
than a path that redirects. `agentblog.dev/docs/*` still resolves: every old
page has a permanent redirect to its new URL.
