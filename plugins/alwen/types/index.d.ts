// The values the Alwen mod keeps in $.state, for this session only.

// One note a search found.
export type AlwenHit = {
  title: string
  path?: string
  url?: string
}

// One finished Alwen call, as the pane lists it.
export type AlwenEntry = {
  // The tool call's id.
  id: string
  kind: 'search' | 'read' | 'rules' | 'remember' | 'decision' | 'rule' | 'failed'
  // The Alwen tool: search, read_note, get_rules, remember, log_decision or propose_rule.
  tool: string
  // The note's title, the search's words, or what didn't go through.
  title?: string
  path?: string
  // The note on GitHub, when Alwen returned its address.
  url?: string
  // A search's first hits, and how many it found.
  hits?: AlwenHit[]
  total?: number
  // The first line of the error, for a call that didn't go through.
  detail?: string
  signIn?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    alwen: {
      // What Alwen did in this session, newest first.
      activity: AlwenEntry[]
    }
  }
}
