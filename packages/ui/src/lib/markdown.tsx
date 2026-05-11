// XSS defense per D-17 + RESEARCH.md Pitfall 9 — schema extends hast-util-sanitize defaultSchema with GFM checkbox support only.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { CodeBlock } from '../components/transcript/CodeBlock'

// GFM-aware sanitizer schema (Pitfall 9): start from rehype-sanitize defaultSchema,
// add task-list <input type="checkbox"> support that remark-gfm emits.
// defaultSchema already strips raw <script>, javascript: URLs (via urlSchemes allow-list
// http/https/mailto/tel only), and on* event handlers (attribute allow-list).
export const gfmSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    input: [
      ['type', 'checkbox'],   // restrict input to type=checkbox only
      'checked',
      'disabled',
    ],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'input'],
}

export function MarkdownRenderer({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, gfmSchema]]}
      skipHtml                                       // belt-and-braces: also strip raw HTML at react-markdown layer
      components={{
        code({ className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className ?? '')
          const raw = String(children).replace(/\n$/, '')
          if (!match) {
            // inline code: <code> with no language fence — render plainly
            return <code className={className} {...rest}>{children}</code>
          }
          return <CodeBlock language={match[1]} code={raw} />
        },
      }}
    >
      {text}
    </ReactMarkdown>
  )
}
