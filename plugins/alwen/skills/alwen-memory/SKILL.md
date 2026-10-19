---
name: alwen-memory
description: Use the person's Alwen memory. Check their rules when a session starts, search it before answering about their work, people, projects or past decisions, and save decisions and lasting facts back to it.
---

Alwen is this person's memory, shared by every AI tool they use. It is a private
GitHub repository of markdown notes: their profile, rules, knowledge and decisions.
The `alwen` MCP server in this plugin reads and writes it.

## When to use it

- **Starting work**: call `get_rules` once and follow what it says. The rules are the
  person's own, written for every tool.
- **Before answering about them**: anything about their work, projects, people,
  preferences or past decisions. Call `search` with a few keywords, then `read_note`
  for the best hits. Say which note you used.
- **A decision is made**: call `log_decision` with the decision, why, and what else was
  considered. It lands in `journal/`.
- **Something lasting comes up**: a fact about the person or their work that another
  tool would need next week. Call `remember` with one self-contained fact and a short
  title. It lands in their inbox, signed by this tool.
- **A standing preference** ("always…", "never…"): call `propose_rule`. The person
  approves it before it applies anywhere.

## What not to do

- Don't save secrets, passwords, keys, personal data about other people, or one-off chatter.
- Don't save the same fact twice: search first.
- Alwen never deletes anything, and neither should you. To correct a note, save the
  correction with `remember` and say what it replaces.

## If it isn't connected

If a call fails because Alwen isn't signed in, tell the person:
- Claude Code: type `/mcp`, choose **alwen**, and click Allow on the Alwen page.
- Codex: run `codex mcp login alwen`.
- No vault yet: finish setting it up at https://alwen-web-knve6.ondigitalocean.app/app.
