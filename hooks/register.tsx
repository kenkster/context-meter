import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Meter } from '../types'

const meter = atom({ plugin: 'context-meter', key: 'meter' } as const, null)
const warned = atom({ plugin: 'context-meter', key: 'warned' } as const, 0)

const k = (n?: number) => (n === undefined ? '?' : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)

export const register: Register = on => {
  on('session.measure', async ($, e, next) => {
    const five = e.rateLimits.find(r => r.kind === 'five_hour')
    const seven = e.rateLimits.find(r => r.kind === 'seven_day')
    const m: Meter = {
      tokens: e.context.tokens,
      window: e.context.window,
      percent: e.context.percent,
      fiveHour: five?.percentUsed,
      sevenDay: seven?.percentUsed,
    }
    await update($, meter, () => m)

    const pct = m.percent ?? 0
    const last = await read($, warned)
    // Warn once at each threshold, so the toast doesn't repeat every turn
    for (const t of [50, 75, 90]) {
      if (pct >= t && last < t) {
        $.ui.toast(
          t >= 75
            ? `Context ${pct}% full. Ask Claude for a handoff summary and continue in a new chat.`
            : `Context ${pct}% full. Every message now re-sends a large history.`,
        )
        await update($, warned, () => t)
      }
    }
    if (pct < 50 && last > 0) await update($, warned, () => 0)

    $.ui.status(`Context ${k(m.tokens)} / ${k(m.window)}${m.percent !== undefined ? ` (${m.percent}%)` : ''}`)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const m = await read($, meter)
    if (e.props.hasSurvey || m === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const pct = m.percent
    const level = pct === undefined ? '' : pct >= 75 ? '  · start a new chat' : pct >= 50 ? '  · getting heavy' : ''
    const limits = [
      m.fiveHour !== undefined ? `5h limit ${m.fiveHour}%` : '',
      m.sevenDay !== undefined ? `weekly ${m.sevenDay}%` : '',
    ].filter(Boolean).join(', ')

    return (
      <Box>
        <Text dimColor>
          Context {k(m.tokens)} / {k(m.window)}{pct !== undefined ? ` (${pct}%)` : ''}{level}{limits ? `   ${limits}` : ''}
        </Text>
      </Box>
    )
  })
}
