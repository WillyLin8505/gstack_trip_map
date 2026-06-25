# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:
- `/office-hours` — YC-style office hours session
- `/plan-ceo-review` — CEO-level plan review
- `/plan-eng-review` — Engineering plan review
- `/plan-design-review` — Design plan review
- `/design-consultation` — Full design system proposal
- `/design-shotgun` — Generate and compare multiple design variants
- `/design-html` — Production-quality HTML/CSS generation
- `/review` — Cross-AI peer review of phase plans
- `/ship` — Create PR and prepare for merge
- `/land-and-deploy` — Deploy to production
- `/canary` — Post-deploy canary monitoring
- `/benchmark` — Performance regression detection
- `/browse` — Fast headless browser for QA and dogfooding
- `/connect-chrome` — Launch AI-controlled Chromium with sidebar
- `/qa` — Systematically QA test and fix bugs
- `/qa-only` — QA test without fixing
- `/design-review` — Visual QA and design audit
- `/setup-browser-cookies` — Configure browser cookies
- `/setup-deploy` — Configure deployment settings
- `/setup-gbrain` — Set up GBrain integration
- `/retro` — Retrospective on completed work
- `/investigate` — Systematic debugging and root cause analysis
- `/document-release` — Post-ship documentation update
- `/document-generate` — Generate missing documentation
- `/codex` — OpenAI Codex CLI wrapper
- `/cso` — Chief Security Officer mode
- `/autoplan` — Auto-review pipeline (CEO + design + eng + DX)
- `/plan-devex-review` — Developer experience plan review
- `/devex-review` — Live developer experience audit
- `/careful` — Safety guardrails for destructive commands
- `/freeze` — Restrict file edits to a specific directory
- `/guard` — File edit guardrails
- `/unfreeze` — Remove freeze restrictions
- `/gstack-upgrade` — Upgrade gstack to latest version
- `/learn` — Manage project learnings

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
