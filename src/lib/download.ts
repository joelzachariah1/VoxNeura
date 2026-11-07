export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (value: string | number | null) => {
    if (value === null) return ''
    const text = String(value)
    if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
    return text
  }
  const lines = [headers, ...rows].map((row) => row.map(escape).join(','))
  return `${lines.join('\r\n')}\r\n`
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, text: string): void {
  downloadText(filename, text, 'text/csv;charset=utf-8')
}

export function downloadSvgElement(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const xml = new XMLSerializer().serializeToString(clone)
  downloadText(filename, xml, 'image/svg+xml;charset=utf-8')
}

export async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 is not available in this browser.')
  }
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
