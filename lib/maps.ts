export function getMapsUrl(adresa: string, preferMapyCz = false): string {
  const encoded = encodeURIComponent(adresa)
  if (preferMapyCz) {
    return `https://mapy.cz/zakladni?q=${encoded}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`
}

/** Navigace na přesné souřadnice (místo stavby z „Jsem na místě“ v Sales) */
export function getMapsUrlGps(lat: number, lng: number, preferMapyCz = false): string {
  const la = lat.toFixed(6)
  const ln = lng.toFixed(6)
  if (preferMapyCz) return `https://mapy.cz/zakladni?x=${ln}&y=${la}&z=18&source=coor&id=${ln}%2C${la}`
  return `https://www.google.com/maps/search/?api=1&query=${la}%2C${ln}`
}
