import type {
  SessionDetailResponse,
  SubagentRef,
  ToolInteraction,
  Turn,
} from '@cc-viewer/shared'

interface UserTurnOpts {
  uuid: string
  text: string
  timestamp?: string
  toolResults?: Turn['toolResults']
}

export function userTurn({ uuid, text, timestamp = '2026-05-22T00:00:00.000Z', toolResults = [] }: UserTurnOpts): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp,
    role: 'user',
    textBlocks: [text],
    thinkingBlocks: [],
    toolUses: [],
    toolResults,
    isMeta: false,
    agentId: null,
  }
}

interface AssistantTurnOpts {
  uuid: string
  texts?: string[]
  thinking?: string[]
  toolUses?: Turn['toolUses']
  timestamp?: string
  model?: string
  usage?: Turn['usage']
}

export function assistantTurn({
  uuid,
  texts = [],
  thinking = [],
  toolUses = [],
  timestamp = '2026-05-22T00:00:01.000Z',
  model = 'claude-opus-4-7',
  usage,
}: AssistantTurnOpts): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp,
    role: 'assistant',
    textBlocks: texts,
    thinkingBlocks: thinking,
    toolUses,
    toolResults: [],
    usage: usage ?? {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    model,
    isMeta: false,
    agentId: null,
  }
}

export function toolInteraction(toolUseId: string, tool: string): ToolInteraction {
  return {
    id: `turn:${toolUseId}`,
    turnUuid: 'turn',
    toolUseId,
    tool,
    resultTurnUuid: 'turn-result',
    status: 'success',
    startedAt: '2026-05-22T00:00:01.000Z',
    durationMs: 120,
    diff: null,
    preview: null,
  }
}

export function subagentRef(opts: {
  agentId: string
  toolUseId: string
  turns?: Turn[]
}): SubagentRef {
  return {
    agentId: opts.agentId,
    agentType: 'general-purpose',
    description: 'spawned subagent',
    toolUseId: opts.toolUseId,
    status: 'completed',
    turns: opts.turns ?? [],
    childAgentIds: [],
  }
}

/**
 * Multi-turn fixture used across hook tests. Contents:
 *   - turn A: normal user prompt + assistant reply with a Bash tool_use
 *   - turn B: stderr-envelope prompt + assistant reply with a Read tool_use
 *     (which targets a subagent via childAgentId)
 *   - turn C: normal user prompt + assistant reply with two requests:
 *     a thinking-only first response, then an Edit (diff) tool_use
 */
export function buildMultiTurnDetail(): SessionDetailResponse {
  const turnA_user = userTurn({ uuid: 'u-a', text: 'do the thing' })
  const tuBash = { id: 'tu-bash', name: 'Bash', input: { command: 'ls' } }
  const turnA_asst = assistantTurn({
    uuid: 'a-a',
    texts: ['ok, running ls'],
    toolUses: [tuBash],
  })

  const turnB_user = userTurn({ uuid: 'u-b', text: '[stderr] something failed' })
  const tuAgent = {
    id: 'tu-agent',
    name: 'Agent',
    input: { description: 'spawn helper' },
    childAgentId: 'sub-1',
  }
  const turnB_asst = assistantTurn({
    uuid: 'a-b',
    texts: ['spawning helper'],
    toolUses: [tuAgent],
  })

  const turnC_user = userTurn({
    uuid: 'u-c',
    text: 'now patch the file',
    toolResults: [
      {
        tool_use_id: 'tu-bash',
        content: 'total 0',
      },
    ],
  })
  const turnC_asst1 = assistantTurn({
    uuid: 'a-c1',
    texts: ['thinking-only'],
    thinking: ['considering options'],
  })
  const tuEdit = {
    id: 'tu-edit',
    name: 'Edit',
    input: {
      file_path: '/tmp/a.ts',
      old_string: 'const a = 1',
      new_string: 'const a = 2',
    },
  }
  const turnC_asst2 = assistantTurn({
    uuid: 'a-c2',
    texts: ['applied patch'],
    toolUses: [tuEdit],
  })

  return {
    turns: [
      turnA_user,
      turnA_asst,
      turnB_user,
      turnB_asst,
      turnC_user,
      turnC_asst1,
      turnC_asst2,
    ],
    subagents: [
      subagentRef({
        agentId: 'sub-1',
        toolUseId: 'tu-agent',
        turns: [
          userTurn({ uuid: 'sub-u', text: 'sub prompt' }),
          assistantTurn({
            uuid: 'sub-a',
            texts: ['sub reply'],
            toolUses: [{ id: 'sub-tu', name: 'Bash', input: { command: 'echo hi' } }],
          }),
        ],
      }),
    ],
    usage: {
      inputTokens: 300,
      outputTokens: 150,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      byAgent: {},
    },
    parseWarnings: 0,
    toolInteractions: [
      toolInteraction('tu-bash', 'Bash'),
      toolInteraction('tu-agent', 'Agent'),
      toolInteraction('tu-edit', 'Edit'),
    ],
    tokenSeries: { points: [], byModel: [], spikes: [], cacheHitPct: 0, avgPerTurn: 0 },
    fileTouchIndex: { files: [] },
  }
}
