export type Meter = {
  tokens?: number
  window: number
  percent?: number
  fiveHour?: number
  sevenDay?: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-meter': { meter: Meter | null; warned: number }
  }
}
