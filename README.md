# Alwen plugins

One memory for every AI you work with. This repository adds Alwen to Claude Code and
Codex as a plugin: the Alwen memory server, plus a skill that tells the agent when to
check your rules, search your notes and save decisions.

You need an Alwen account with a vault. Get one at
https://alwen.ai.

## Claude Code

```
/plugin marketplace add alwen-memory/plugins
/plugin install alwen@alwen
```

Then type `/mcp`, choose **alwen**, and click Allow on the Alwen page that opens.

### See what Alwen did

Type `/alwen` to open the Alwen pane. It has two tabs:

- **This session**: what Alwen read for Claude (search results, notes it opened, your
  rules) and what it saved (facts, decisions, proposed rules). Newest first, each with
  a link to the note on GitHub.
- **How to use**: what to ask, with examples.

Once Claude has used Alwen, a short line above the prompt counts it, such as
`Alwen: 3 notes read, 1 saved`. Click **Details** on that line to open the pane. When
Alwen saves something, a small notice says so.

The pane and the line work in the terminal and in the Claude desktop app. They only
watch: every Alwen call runs and returns as it would without them. The list lasts for
this session only, and `/clear` starts it again.

This part of the plugin is a Claude Code mod. It needs Claude Code 2.1.287 or later,
and was tested with 2.1.304.

## Codex

```
codex plugin marketplace add alwen-memory/plugins
```

Open the Plugins directory in the Codex app, choose **Alwen**, and install it. Codex
opens the Alwen page in your browser; click Allow.

## Cursor

The plugin is in the Cursor Marketplace's review (`.cursor-plugin/marketplace.json` lists it).
Until it's listed, use **Add to Cursor** on your Alwen dashboard.

## Claude, ChatGPT, Grok Bot, Telegram, Slack, Discord

Connect them from your Alwen dashboard: each one has its own page with the one step it
takes.

## What's inside

```
.claude-plugin/marketplace.json   Claude Code catalog
.agents/plugins/marketplace.json  Codex catalog
.cursor-plugin/marketplace.json   Cursor catalog
server.json                       Alwen's entry in the official MCP Registry
scripts/openai-package.mjs        builds the package for OpenAI's plugin directory
plugins/alwen/
  README.md, LICENSE              what the plugin does and sends; MIT
  plugin.json                     plugin manifest (Agent Plugins standard: Codex, Cursor),
                                  with OpenAI's listing and review test cases
  mcp.json                        the Alwen server, for Codex and OpenAI
  .claude-plugin/plugin.json      plugin manifest and the Alwen server, for Claude Code
  .cursor-plugin/plugin.json      plugin manifest and the Alwen server, for Cursor
  skills/alwen-memory/SKILL.md    when to read and write your memory
  hooks/hooks.json                the Claude Code mod: points to hooks/register.js
  hooks/register.js               the /alwen pane, the line above the prompt, the notice
  hooks/alwen.js                  reads Alwen's results; the words the mod shows
  types/index.d.ts                what the mod keeps for the session
```

The plugin holds no keys: each tool signs in to your memory with OAuth, and you click
Allow once.

MIT licensed.
