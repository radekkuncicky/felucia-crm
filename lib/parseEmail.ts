export function parseEmailInput(value: string): string {
  const trimmed = value.trim()
  // Matches "Name <email>" or "Name Surname <email>"
  const match = trimmed.match(/<([^>]+)>/)
  if (match) return match[1].trim()
  return trimmed
}
