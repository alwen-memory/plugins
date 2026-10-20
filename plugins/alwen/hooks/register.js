// The Alwen mod. It watches Alwen's tool calls and shows what Alwen read and
// saved in this session: a pane that /alwen opens, a line above the prompt
// once Alwen has been used, and a toast when Alwen saves something.
// It only watches: every call runs and returns exactly as it would without it.
import { atom, read, update } from 'claude-code'

import {
  EXAMPLES,
  addEntry,
  countsText,
  entryFor,
  labelFor,
  noteFor,
  statusText,
  summarize,
  titleFor,
  toastFor,
} from './alwen.js'

// The pane's id, used to open it and to recognize it when drawing.
const PANE = 'alwen'

// Alwen's tools, from the plugin's own server or one the user added:
// mcp__plugin_alwen_alwen__search, mcp__alwen__search, mcp__claude_ai_Alwen__search.
const ALWEN_TOOL = /^mcp__.*alwen.*__(search|read_note|get_rules|remember|log_decision|propose_rule)$/i

// What Alwen did in this session, newest first. $.state holds it for this
// session only: /clear, /resume and /branch empty it, and nothing goes to disk.
const activity = atom({ plugin: 'alwen', key: 'activity' }, [])

// Which tab the pane shows. A reload of the mod puts it back to the first.
let tab = 'session'

/** @param {import('claude-code').On} on */
export function register(on) {
  // Add /alwen. A taken name throws, so the call is wrapped.
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'alwen',
        description: 'Show what Alwen read and saved in this session',
        immediate: true,
      })
    } catch (error) {
      $.ui.log('alwen: /alwen was not added: ' + errorText(error), { to: 'debug' })
    }
    return next(e)
  })

  // /alwen opens the pane on its first tab and prints nothing.
  on('command.run', { command: 'alwen' }, async ($) => {
    tab = 'session'
    try {
      const opened = await $.ui.open({ id: PANE, title: 'Alwen', focus: true, closeOnEscape: true })
      if (opened && opened.isPlaced === false) {
        return { text: 'The Alwen pane opens when there is room for it.' }
      }
      $.ui.invalidate('ui.render')
    } catch {
      return { text: 'Alwen could not open its pane here.' }
    }
    return {}
  })

  // Each Alwen call: let it run, then note what it read or saved.
  on('tool.call', { tool: ALWEN_TOOL }, async ($, e, next) => {
    const ran = await next(e)
    try {
      const entry = entryFor({ tool: e.tool, id: e.tool_use_id, input: e }, ran)
      if (entry) {
        await update($, activity, (list) => addEntry(list, entry))
        const toast = toastFor(entry)
        if (toast) $.ui.toast(toast)
      }
    } catch (error) {
      $.ui.log('alwen: a call was not noted: ' + errorText(error), { to: 'debug' })
    }
    // The result exactly as it came, so Claude reads what Alwen returned.
    return ran
  }).catch(($, e, next) => next(e))

  // The pane: two tabs, drawn again whenever the session's list changes.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const el = $.ui.resolve(e)
    try {
      const list = asList(await read($, activity))
      const show = (name) => () => {
        tab = name
        $.ui.invalidate('ui.render')
      }
      return drawPane(el, tab, list, show)
    } catch (error) {
      $.ui.log('alwen: the pane was not drawn: ' + errorText(error), { to: 'debug' })
      return el.Text({ children: ['Alwen could not draw this pane. Type /alwen to try again.'] })
    }
  })

  // The band above the prompt: one dim line, only once Alwen has been used.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    let line
    try {
      if (!(e.props && e.props.hasSurvey)) line = statusText(summarize(asList(await read($, activity))))
    } catch {
      line = undefined
    }
    if (!line) return next(e)
    // Keep what other mods draw in the band, under this line.
    const below = await next(e)
    try {
      const { Box, Text, Button } = $.ui.resolve(e)
      const row = Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Text({ dimColor: true, wrap: 'truncate-end', children: [line] }),
          Button({
            key: 'alwen-details',
            label: 'Details',
            plain: true,
            dimColor: true,
            onPress: () => {
              tab = 'session'
              return $.ui.open({ id: PANE, title: 'Alwen', focus: true, closeOnEscape: true })
            },
          }),
        ],
      })
      return below ? Box({ flexDirection: 'column', children: [row, below] }) : row
    } catch {
      return below
    }
  })
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

// The error's name and message, cut short, for the debug log.
function errorText(error) {
  const text = error instanceof Error ? error.name + ': ' + error.message : String(error)
  return text.slice(0, 200)
}

// The whole pane: the row of tabs, a blank line, then the open tab.
function drawPane(el, open, list, show) {
  const { Box, Text, Button } = el
  const tabButton = (name, label, hotkey) =>
    Button({
      key: 'tab-' + name,
      label,
      hotkey,
      plain: true,
      dimColor: open !== name,
      onPress: show(name),
    })
  return Box({
    flexDirection: 'column',
    children: [
      Box({
        flexDirection: 'row',
        columnGap: 3,
        children: [tabButton('session', 'This session', '1'), tabButton('how', 'How to use', '2')],
      }),
      Text({ children: [' '] }),
      ...(open === 'how' ? howToUse(el) : thisSession(el, list)),
    ],
  })
}

// "This session": newest first, each with its link, or what to try.
function thisSession(el, list) {
  const { Box, Text } = el
  if (list.length === 0) {
    return [
      Text({ bold: true, children: ['Nothing from Alwen yet in this session.'] }),
      Text({ children: ['When Claude reads or saves a note in Alwen, it shows here with a link.'] }),
      Text({ children: [' '] }),
      Text({ children: ['Try asking Claude:'] }),
      ...EXAMPLES.slice(0, 2).map((example) => Text({ children: ['  "' + example + '"'] })),
      Text({ children: [' '] }),
      Text({ dimColor: true, children: ['How to use has more examples.'] }),
    ]
  }
  const counts = countsText(summarize(list))
  return [
    Text({ bold: true, children: [counts ? counts + ' in this session.' : 'Alwen in this session.'] }),
    Text({ children: [' '] }),
    Box({ flexDirection: 'column', rowGap: 1, children: list.map((entry) => entryRows(el, entry)) }),
  ]
}

// One call: its label and title, then its link, its hits or a note.
function entryRows(el, entry) {
  const { Box, Text } = el
  const title = titleFor(entry)
  const note = noteFor(entry)
  const rows = [
    Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        Text({ bold: true, children: [labelFor(entry)] }),
        ...(title ? [Text({ children: [title] })] : []),
      ],
    }),
  ]
  if (entry.kind !== 'search' && (entry.url || entry.path)) {
    rows.push(indented(el, [linkText(el, entry.url, entry.path || 'Open on GitHub', true)]))
  }
  if (note) rows.push(indented(el, [Text({ dimColor: true, children: [note] })]))
  if (entry.kind === 'search' && Array.isArray(entry.hits)) {
    for (const hit of entry.hits) {
      rows.push(
        indented(el, [
          Box({
            flexDirection: 'row',
            columnGap: 1,
            children: [
              linkText(el, hit.url, hit.title || 'Untitled note', false),
              ...(hit.path ? [Text({ dimColor: true, wrap: 'truncate-end', children: [hit.path] })] : []),
            ],
          }),
        ]),
      )
    }
  }
  return Box({ key: 'entry-' + entry.id, flexDirection: 'column', children: rows })
}

function indented(el, children) {
  return el.Box({ flexDirection: 'column', paddingLeft: 2, children })
}

// A link when there is an https address, plain text otherwise.
function linkText(el, url, label, isDim) {
  const { Text, Link } = el
  const style = isDim ? { dimColor: true, wrap: 'truncate-end' } : { wrap: 'truncate-end' }
  if (typeof url === 'string' && url.startsWith('https://')) {
    return Text({ ...style, children: [Link({ href: url, label })] })
  }
  return Text({ ...style, children: [label] })
}

// "How to use": plain instructions and example prompts.
function howToUse(el) {
  const { Text } = el
  return [
    Text({ children: ['Alwen is your memory, shared by every AI tool you use. Claude reads it and saves to it while you work.'] }),
    Text({ children: [' '] }),
    Text({ children: ['Alwen loads your rules at the start of a session, so Claude follows them from the first reply.'] }),
    Text({ children: [' '] }),
    Text({ bold: true, children: ['Try asking Claude:'] }),
    ...EXAMPLES.map((example) => Text({ children: ['  "' + example + '"'] })),
    Text({ children: [' '] }),
    Text({ children: ['Facts you save go to your inbox. Decisions go to your journal. A new rule waits for your approval.'] }),
    Text({ children: [' '] }),
    Text({ dimColor: true, children: ["If Alwen isn't connected, type /mcp, choose alwen, and click Allow."] }),
  ]
}
