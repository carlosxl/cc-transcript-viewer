# cc-transcript-viewer

Local web-UI viewer for Claude Code conversation transcripts.

## Install & run

```bash
npx github:carlosxl/cc-transcript-viewer#v0.1.0
```

Requires Node.js 20+ and read access to the private repo (GitHub SSH key
or HTTPS token in your git credential helper). The first run takes ~30s to
clone, install dependencies, and build; subsequent runs are cached by npx.

The server starts on a free localhost port and opens your browser to it.
Use Ctrl+C to stop.

To update to a newer version, re-run with the new tag:

```bash
npx github:carlosxl/cc-transcript-viewer#v0.2.0
```

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
