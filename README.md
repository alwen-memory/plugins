# Alwen plugins

One memory for every AI you work with. This repository adds Alwen to Claude Code and
Codex as a plugin: the Alwen memory server, plus a skill that tells the agent when to
check your rules, search your notes and save decisions.

You need an Alwen account with a vault. Get one at
https://alwen-web-knve6.ondigitalocean.app.

## Claude Code

```
/plugin marketplace add alwen-memory/plugins
/plugin install alwen@alwen
```

Then type `/mcp`, choose **alwen**, and click Allow on the Alwen page that opens.

## Codex

```
codex plugin marketplace add alwen-memory/plugins
```

Open the Plugins directory in the Codex app, choose **Alwen**, and install it. Codex
opens the Alwen page in your browser; click Allow.

## Claude, ChatGPT, Cursor, Grok Bot, Telegram, Slack, Discord

Connect them from your Alwen dashboard: each one has its own page with the one step it
takes.

## What's inside

```
.claude-plugin/marketplace.json   Claude Code catalog
.agents/plugins/marketplace.json  Codex catalog
plugins/alwen/
  plugin.json                     plugin manifest (Agent Plugins standard: Codex, Cursor)
  mcp.json                        the Alwen server, for Codex and Cursor
  .claude-plugin/plugin.json      plugin manifest and the Alwen server, for Claude Code
  .cursor-plugin/plugin.json      plugin manifest for Cursor
  skills/alwen-memory/SKILL.md    when to read and write your memory
```

The plugin holds no keys: each tool signs in to your memory with OAuth, and you click
Allow once.

MIT licensed.
