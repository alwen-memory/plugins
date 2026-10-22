# Alwen

One memory for every AI you work with. Alwen keeps your rules, notes and decisions as plain
markdown in a private Git repository that's yours, and every AI tool you connect reads it first
and writes back to it. This plugin connects Claude Code, Codex and Cursor to your Alwen memory.

You need an Alwen account: sign up at https://alwen.ai with Google or GitHub.

## What's in it

- **The Alwen memory server** (`https://api.alwen.ai/mcp`). The first time it's used, the tool
  opens an Alwen page in your browser; click Allow. The plugin holds no keys.
- **The `alwen-memory` skill**, which tells the agent when to use your memory: check your rules
  when work starts, search before answering about your work, and save decisions and lasting
  facts back.
- **In Claude Code only, the Alwen pane**: type `/alwen` to see what Alwen read and saved in this
  session, and a short line above the prompt counts it. It needs Claude Code 2.1.287 or later.

## What the agent can do with your memory

| Tool | What it does |
|---|---|
| `get_rules` | Reads your rules (read only) |
| `search` | Searches your notes (read only) |
| `read_note` | Opens one note (read only) |
| `remember` | Saves a fact to `inbox/<tool>/` |
| `log_decision` | Saves a decision, why, and what else was considered, to `journal/` |
| `propose_rule` | Suggests a rule; it waits for your approval |
| `jobs`, `next_task`, `task_done` | Work @alwen hands to this tool, and handing it back |

Every write is a commit in your repository, signed with the tool that made it. Alwen never
deletes notes.

## What it sends, and where

- The memory server runs at `api.alwen.ai`. The agent sends it your search words and what it
  saves; it returns your notes. Nothing else is sent.
- The Alwen pane makes no network calls. It reads the results of Alwen's tools inside the
  session, keeps them in memory until the session ends, and links to notes on GitHub.

Privacy: https://alwen.ai/privacy · Terms: https://alwen.ai/terms ·
Support: https://alwen.ai/support or support@alwen.ai

## Install

- **Claude Code**: `/plugin marketplace add alwen-memory/plugins`, then
  `/plugin install alwen@alwen`, then `/mcp`, choose **alwen** and click Allow.
- **Codex**: `codex plugin marketplace add alwen-memory/plugins`, then install **Alwen** from the
  Plugins directory and click Allow.
- **Cursor**: the plugin is in the Cursor Marketplace's review. Until it's listed, use **Add to
  Cursor** on your Alwen dashboard.

MIT licensed.
