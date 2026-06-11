export function getMapsUrl(adresa: string, preferMapyCz = false): string {
  const encoded = encodeURIComponent(adresa)
  if (preferMapyCz) {
    return `https://mapy.cz/zakladni?q=${encoded}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`
}
