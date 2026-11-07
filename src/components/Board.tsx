type BoardProps = {
  choices: readonly string[]
  onChoose?: (token: string) => void
  pending?: string | null
}

export function Board({ choices, onChoose, pending = null }: BoardProps) {
  return (
    <div className="board" data-count={choices.length} role="group" aria-label="Communication choices">
      {choices.map((word, index) => (
        <button
          key={word}
          type="button"
          className="key"
          disabled={!onChoose}
          onClick={() => onChoose?.(word)}
        >
          <span className="key-index">{index < 9 ? index + 1 : ''}</span>
          <span className="key-word">{word}</span>
          {pending === word ? <span className="key-note">Waiting</span> : <span className="key-note" />}
        </button>
      ))}
    </div>
  )
}
