import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <header className="page-head">
      <p className="kicker">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="lede">{children}</div>
    </header>
  )
}
