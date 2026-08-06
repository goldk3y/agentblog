# Security policy

## Reporting a vulnerability

Report security issues privately through
[GitHub Security Advisories](https://github.com/goldk3y/agentblog/security/advisories/new).
Do not open a public issue.

We aim to acknowledge a report within three working days and to ship a fix or a
mitigation within fourteen days for anything exploitable. If a report turns out
to affect an upstream project rather than AgentBlog, we will say so and help you
route it.

## What is in scope

AgentBlog has two distinct attack surfaces, and a report is more useful when it
says which one it is about.

**The CLI (`agentblog`) runs on a developer's machine and edits their files.**
In scope: arbitrary file write outside the project root, command injection
through any value the CLI reads from a config file or a prompt, a patch that
corrupts a file while reporting success, and anything that causes the CLI to
execute code from a registry response.

**The blog block runs in production on a consumer's website.** In scope:
injection into the rendered JSON-LD, the RSS feed, `robots.txt`, or the sitemap;
authentication bypass or SSRF through `app/api/publish/route.ts`; path traversal
through a slug into the content source; and anything that leaks a secret into a
client bundle or into rendered HTML.

## What is out of scope

- The shadcn registry mechanism itself. `shadcn add <url>` fetches JSON and
  writes files from it, which means adding a registry URL to `components.json`
  is equivalent to trusting a package. That is upstream behaviour and it is
  documented, not a vulnerability in AgentBlog.
- MDX is executable by design. A post can import and evaluate JavaScript, so
  content in `content/blog/**` is trusted input in the same sense that source
  code is. If you wire a content source that serves MDX written by people you do
  not trust, that is remote code execution in your own server, and the
  documentation says so. A report that demonstrates this is a documentation
  question rather than a vulnerability.
- Denial of service through a deliberately enormous post or an unrealistic
  number of posts.
- Findings that require an attacker to already have write access to the
  repository or to the deployment's environment variables.

## Supported versions

AgentBlog is pre-1.0. Only the latest published version of `agentblog` on npm
receives fixes. Once the blog block is installed, its files live in your
repository and are yours: we cannot patch them for you, so a security fix in the
block ships as a registry update plus a release note telling you which files
changed.
