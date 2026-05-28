/**
 * Renders an AskUserQuestion result sidecar (007-ui-information-revamp, T026).
 *
 * Q&A pairs: question text, available options, the user's selected answer, and
 * any free-form annotations. Schema source: schema.ts:451-470.
 *
 * Standalone for now — wired into BlockToolResult's structured-sidecar tab in a
 * follow-up integration task.
 */
import type { AskUserQuestionResult } from '@cc-viewer/shared'

interface BlockAskUserQuestionProps {
  result: AskUserQuestionResult
}

export function BlockAskUserQuestion({ result }: BlockAskUserQuestionProps) {
  return (
    <div className="va-ask-user-question">
      {result.questions.map((q, i) => {
        const answer = result.answers[q.question]
        const annotation = result.annotations?.[q.question]
        return (
          <section className="va-aqu-item" key={i}>
            {q.header && <div className="va-aqu-header">{q.header}</div>}
            <div className="va-aqu-question">{q.question}</div>
            {q.options.length > 0 && (
              <ul className="va-aqu-options">
                {q.options.map((opt, j) => (
                  <li
                    key={j}
                    className={'va-aqu-option' + (answer === opt.label ? ' is-selected' : '')}
                  >
                    <span className="label">{opt.label}</span>
                    {opt.description && <span className="desc"> — {opt.description}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="va-aqu-answer">
              <span className="va-aqu-answer-label">Answered:</span>{' '}
              <span className="va-aqu-answer-value">{answer ?? '(no answer recorded)'}</span>
            </div>
            {annotation !== undefined && annotation !== null && (
              <details className="va-aqu-annotation">
                <summary>annotation</summary>
                <pre>{JSON.stringify(annotation, null, 2)}</pre>
              </details>
            )}
          </section>
        )
      })}
    </div>
  )
}
