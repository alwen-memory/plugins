// What the Alwen mod reads from Alwen's tool calls, and the words it shows.
// Plain functions with no `$`, so they can be checked on their own. Every
// function here takes whatever it is given and never throws on odd input.

// The Alwen tools the mod watches, by the last part of their name.
const TOOLS = ['search', 'read_note', 'get_rules', 'remember', 'log_decision', 'propose_rule']

// How many calls the session list keeps, and how many hits of one search.
export const MAX_ENTRIES = 50
const MAX_HITS = 8

// What each tool was doing, for a call that didn't go through.
const DOING = {
  search: 'Search',
  read_note: 'Reading a note',
  get_rules: 'Loading your rules',
  remember: 'Saving a note',
  log_decision: 'Logging a decision',
  propose_rule: 'Proposing a rule',
}

// Keys a tool call carries beside the tool's own arguments.
const RESERVED = new Set(['tool', 'tool_use_id', 'agentId', 'requestMeta', 'consent'])

// Example prompts, shown in the pane.
export const EXAMPLES = [
  'check Alwen for what we decided about pricing',
  'save this decision to Alwen',
  'what are my rules for writing?',
  'remember that Ana owns the pricing page',
  'search Alwen for my notes on the launch',
]

// The Alwen tool a tool name is, or undefined. A name counts when it starts
// with mcp__, its server part contains "alwen", and it ends with __<tool>:
// mcp__plugin_alwen_alwen__search, mcp__alwen__search, mcp__claude_ai_Alwen__search.
export function alwenTool(name) {
  if (typeof name !== 'string' || !name.startsWith('mcp__')) return undefined
  for (const tool of TOOLS) {
    const suffix = '__' + tool
    if (!name.endsWith(suffix)) continue
    const server = name.slice('mcp__'.length, name.length - suffix.length)
    if (/alwen/i.test(server)) return tool
  }
  return undefined
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// One line of at most `max` characters.
function oneLine(value, max = 120) {
  if (typeof value !== 'string') return ''
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > max ? line.slice(0, max - 1).trimEnd() + '…' : line
}

function firstLine(text) {
  if (typeof text !== 'string') return ''
  const line = text.split('\n').find((one) => one.trim() !== '')
  return line ? line.trim() : ''
}

function parseJson(text) {
  if (typeof text !== 'string') return undefined
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

// An https address, or undefined. Remote surfaces draw only https links.
function httpsUrl(value) {
  if (typeof value !== 'string') return undefined
  const url = value.trim()
  return /^https:\/\/\S+$/.test(url) && url.length <= 2048 ? url : undefined
}

function cleanPath(value) {
  if (typeof value !== 'string') return undefined
  const path = value.trim()
  return path && path.length <= 512 && !/\s{2,}|\n/.test(path) ? path : undefined
}

// The note's path in the repository, from a GitHub address.
function pathFromUrl(url) {
  if (!url) return undefined
  const match = /\/(?:blob|tree)\/[^/]+\/(.+?)(?:[?#].*)?$/.exec(url)
  const raw = match ? match[1] : undefined
  if (!raw) return undefined
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function nameFromPath(path) {
  if (!path) return ''
  const base = path.split('/').filter(Boolean).pop() || ''
  return base.replace(/\.md$/i, '')
}

// The text the model read for the call: core's `text`, else the result itself.
function resultText(ran) {
  if (!isObject(ran)) return ''
  if (typeof ran.text === 'string') return ran.text
  return blocksText(ran.result)
}

function blocksText(value) {
  if (typeof value === 'string') return value
  const blocks = Array.isArray(value) ? value : isObject(value) && Array.isArray(value.content) ? value.content : []
  return blocks
    .map((block) => (isObject(block) && typeof block.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
}

// Every object and list in the result, outermost first: the result, any
// structuredContent, and JSON inside text blocks. The shape of an MCP tool's
// result in a tool.call is not documented, so the mod looks in all of them.
function candidates(ran) {
  const found = []
  const queue = [
    [isObject(ran) ? ran.structuredContent : undefined, 0],
    [isObject(ran) ? ran.result : undefined, 0],
    [isObject(ran) ? ran.text : undefined, 0],
  ]
  let visited = 0
  while (queue.length > 0 && visited < 300) {
    const next = queue.shift()
    if (!next) break
    const [value, depth] = next
    visited += 1
    if (value == null || depth > 5) continue
    if (typeof value === 'string') {
      const parsed = parseJson(value)
      if (parsed !== undefined) queue.push([parsed, depth + 1])
      continue
    }
    if (Array.isArray(value)) {
      found.push(value)
      for (const item of value) {
        if (isObject(item) && item.type === 'text') queue.push([item.text, depth + 1])
        else queue.push([item, depth + 1])
      }
      continue
    }
    if (!isObject(value)) continue
    found.push(value)
    if ('structuredContent' in value) queue.unshift([value.structuredContent, depth + 1])
    for (const key of Object.keys(value)) {
      if (key === 'structuredContent') continue
      const child = value[key]
      if (child !== null && (typeof child === 'object' || (typeof child === 'string' && /^\s*[[{]/.test(child)))) {
        queue.push([child, depth + 1])
      }
    }
  }
  return found
}

// The note a result points to: its path, address and title, from the first
// object that names a path or an address, else from the text.
function noteOf(found, text) {
  for (const value of found) {
    if (!isObject(value)) continue
    const url = httpsUrl(value.url) || httpsUrl(value.html_url) || httpsUrl(value.link)
    const path = cleanPath(value.path) || pathFromUrl(url)
    if (url || path) return { url, path, title: oneLine(value.title) || titleInText(text) }
  }
  const url = (text.match(/https:\/\/github\.com\/[^\s)"'<>\]]+/) || [])[0]
  const pathMatch = /(?:^|[\s`'"(])((?:[\w.-]+\/)*[\w.-]+\.md)\b/.exec(text)
  return {
    url: httpsUrl(url),
    path: (pathMatch && pathMatch[1]) || pathFromUrl(url),
    title: titleInText(text),
  }
}

// A markdown note's title: its front matter's `title:`, else its first heading.
function titleInText(text) {
  if (typeof text !== 'string') return ''
  const front = /^---\s*\n([\s\S]*?)\n---/.exec(text)
  const field = front && front[1] ? /^title:\s*["']?(.+?)["']?\s*$/m.exec(front[1]) : null
  if (field && field[1]) return oneLine(field[1])
  const heading = /^#\s+(.+)$/m.exec(text)
  return heading && heading[1] ? oneLine(heading[1]) : ''
}

// The hits of a search: from `results`, else from GitHub addresses in the text.
function hitsOf(found, text) {
  let results
  for (const value of found) {
    if (isObject(value) && Array.isArray(value.results)) {
      results = value.results
      break
    }
  }
  if (!results) {
    const list = found.find((value) => Array.isArray(value) && value.some((item) => isObject(item) && (item.path || item.url)))
    if (list) results = list
  }
  if (results) {
    const hits = results.filter(isObject).map((item) => {
      const url = httpsUrl(item.url)
      const path = cleanPath(item.path) || pathFromUrl(url)
      return compact({ title: oneLine(item.title) || nameFromPath(path) || 'Untitled note', path, url })
    })
    return { hits: hits.slice(0, MAX_HITS), total: hits.length }
  }
  const urls = [...new Set(text.match(/https:\/\/github\.com\/[^\s)"'<>\]]+/g) || [])]
  const hits = urls.map((url) => {
    const path = pathFromUrl(url)
    return compact({ title: nameFromPath(path) || 'Untitled note', path, url })
  })
  return { hits: hits.slice(0, MAX_HITS), total: hits.length }
}

// The first argument of the call that reads as a title.
function inputText(input, keys) {
  for (const key of keys) {
    if (RESERVED.has(key)) continue
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return oneLine(firstLine(value))
    if (Array.isArray(value) && value.every((one) => typeof one === 'string')) {
      const joined = oneLine(value.join(' '))
      if (joined) return joined
    }
  }
  return ''
}

// The object without its undefined and empty fields, so $.state holds plain JSON.
/** @returns {any} */
function compact(object) {
  const out = {}
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === '' || value === null) continue
    out[key] = value
  }
  return out
}

function needsSignIn(text) {
  return /\b(401|403|unauthori[sz]ed|sign(ed)? ?in|log ?in|oauth|auth(entication|orization)? (required|failed)|not connected)\b/i.test(text)
}

// The list entry for one finished Alwen call, or undefined for a call that
// isn't Alwen's or didn't run (refused before it ran).
//   call: { tool, id, input }, where input holds the tool's arguments
//   ran:  what next(e) resolved to: { result, text } or { isError, text } or { deny }
/** @returns {import('../types').AlwenEntry | undefined} */
export function entryFor(call, ran) {
  try {
    const tool = alwenTool(isObject(call) ? call.tool : undefined)
    if (!tool || !isObject(ran) || typeof ran.deny === 'string') return undefined
    const id = typeof call.id === 'string' && call.id ? call.id : tool
    const input = isObject(call.input) ? call.input : {}
    const text = resultText(ran)
    const failed = ran.isError === true || (isObject(ran.result) && ran.result.isError === true)
    if (failed) {
      return compact({
        id,
        kind: 'failed',
        tool,
        title: DOING[tool] + " didn't go through",
        detail: oneLine(firstLine(text), 160),
        signIn: needsSignIn(text) || undefined,
      })
    }
    const found = candidates(ran)
    if (tool === 'search') {
      const { hits, total } = hitsOf(found, text)
      return compact({
        id,
        kind: 'search',
        tool,
        title: inputText(input, ['query', 'q', 'keywords', 'terms', 'text', 'search']),
        hits,
        total,
      })
    }
    const note = noteOf(found, text)
    if (tool === 'get_rules') {
      return compact({ id, kind: 'rules', tool, title: 'Your rules', path: note.path, url: note.url })
    }
    if (tool === 'read_note') {
      const path = note.path || cleanPath(input.path) || cleanPath(input.note)
      return compact({
        id,
        kind: 'read',
        tool,
        title: note.title || inputText(input, ['title', 'name']) || nameFromPath(path) || 'A note',
        path,
        url: note.url,
      })
    }
    const kind = tool === 'remember' ? 'remember' : tool === 'log_decision' ? 'decision' : 'rule'
    const title =
      inputText(input, ['title', 'name', 'summary', 'decision', 'rule', 'fact', 'text', 'content', 'note', 'body']) ||
      note.title ||
      nameFromPath(note.path) ||
      'A note'
    return compact({ id, kind, tool, title, path: note.path, url: note.url })
  } catch {
    return undefined
  }
}

// Totals for the session: notes read (each note once, from search hits,
// read_note and the rules), notes saved, searches and failed calls.
export function summarize(list) {
  const read = new Set()
  let saved = 0
  let searches = 0
  let failed = 0
  for (const entry of Array.isArray(list) ? list : []) {
    if (!isObject(entry)) continue
    if (entry.kind === 'search') {
      searches += 1
      for (const hit of Array.isArray(entry.hits) ? entry.hits : []) {
        if (isObject(hit)) read.add(hit.path || hit.url || 'title:' + hit.title)
      }
    } else if (entry.kind === 'read' || entry.kind === 'rules') {
      read.add(entry.path || entry.url || entry.kind + ':' + entry.title)
    } else if (entry.kind === 'remember' || entry.kind === 'decision' || entry.kind === 'rule') {
      saved += 1
    } else if (entry.kind === 'failed') {
      failed += 1
    }
  }
  return { read: read.size, saved, searches, failed, total: Array.isArray(list) ? list.length : 0 }
}

// "3 notes read, 1 saved", or undefined when there is nothing to count.
export function countsText(sum) {
  const parts = []
  if (sum.read > 0) parts.push(sum.read + (sum.read === 1 ? ' note read' : ' notes read'))
  if (sum.saved > 0) parts.push(sum.saved + ' saved')
  return parts.length > 0 ? parts.join(', ') : undefined
}

// The line above the prompt, or undefined before Alwen has been used.
export function statusText(sum) {
  if (!sum || sum.total === 0) return undefined
  const counts = countsText(sum)
  if (counts) return 'Alwen: ' + counts
  if (sum.searches > 0) return 'Alwen: no notes found yet'
  return "Alwen: a call didn't go through"
}

// The toast for a save, or undefined.
export function toastFor(entry) {
  if (!isObject(entry)) return undefined
  if (entry.kind === 'remember' || entry.kind === 'decision') return 'Saved to your memory: ' + entry.title
  if (entry.kind === 'rule') return 'Rule sent for your approval: ' + entry.title
  return undefined
}

// The bold words that start an entry's row in the pane.
export function labelFor(entry) {
  switch (entry && entry.kind) {
    case 'search':
      return entry.title ? 'Searched for' : 'Searched your notes'
    case 'read':
      return 'Read'
    case 'rules':
      return 'Loaded your rules'
    case 'remember':
      return 'Saved'
    case 'decision':
      return 'Logged a decision'
    case 'rule':
      return 'Proposed a rule'
    case 'failed':
      return entry.title || "A call didn't go through"
    default:
      return 'Used Alwen'
  }
}

// The words after the label, or '' when the label says it all.
export function titleFor(entry) {
  if (!isObject(entry)) return ''
  if (entry.kind === 'search') return entry.title ? '"' + entry.title + '"' : ''
  if (entry.kind === 'rules' || entry.kind === 'failed') return ''
  return entry.title || ''
}

// A dim line under the entry, or ''.
export function noteFor(entry) {
  if (!isObject(entry)) return ''
  if (entry.kind === 'search') {
    const total = typeof entry.total === 'number' ? entry.total : 0
    if (total === 0) return 'No notes found.'
    const shown = Array.isArray(entry.hits) ? entry.hits.length : 0
    const found = total === 1 ? '1 note found.' : total + ' notes found.'
    return shown < total ? found + ' Showing the first ' + shown + '.' : found
  }
  if (entry.kind === 'rule') return 'It applies once you approve it.'
  if (entry.kind === 'failed') {
    const detail = typeof entry.detail === 'string' ? entry.detail.trim() : ''
    const sentence = detail && !/[.!?…]$/.test(detail) ? detail + '.' : detail
    const fix = entry.signIn ? 'Type /mcp, choose alwen, and click Allow.' : ''
    return [sentence, fix].filter(Boolean).join(' ')
  }
  return ''
}

// The session list with `entry` added first. A note read by its path alone
// takes the title a search in this session gave it.
export function addEntry(list, entry) {
  const prior = Array.isArray(list) ? list.filter((one) => isObject(one) && one.id !== entry.id) : []
  let added = entry
  if (entry.kind === 'read' && entry.path && entry.title === nameFromPath(entry.path)) {
    for (const one of prior) {
      const hit = one.kind === 'search' && Array.isArray(one.hits) ? one.hits.find((h) => isObject(h) && h.path === entry.path) : undefined
      if (hit && hit.title) {
        added = { ...entry, title: hit.title }
        break
      }
    }
  }
  return [added, ...prior].slice(0, MAX_ENTRIES)
}
