# cc-transcript-viewer

Local web-UI viewer for Claude Code conversation transcripts.

## Development

```bash
npm install
npm run typecheck  # must be green before committing
npm run build
```

## Notes

### Empty thinking blocks

Sessions captured by Claude Code 2.1.69+ on Opus 4.7 store thinking blocks
with an empty `thinking` field — only the encrypted signature is persisted.
This is upstream behavior: Anthropic's API defaults Opus 4.7 thinking blocks
to `display: "omitted"`, and Claude Code does not override the default.
Tracking: [anthropics/claude-code#30958](https://github.com/anthropics/claude-code/issues/30958).

To capture summaries in **future** sessions, add to `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXTRA_BODY": "{\"thinking\":{\"type\":\"adaptive\",\"display\":\"summarized\"}}"
  }
}
```

Or launch with `claude --thinking-display summarized`. Past sessions stay
empty — the text was never written to disk.

## License

MIT
