const TEXT = {
  recorded: 'Recorded file',
  computed: 'Computed here',
  demonstration: 'Demonstration',
} as const

export function Mark({ kind }: { kind: keyof typeof TEXT }) {
  return <span className={`mark mark-${kind}`}>{TEXT[kind]}</span>
}
