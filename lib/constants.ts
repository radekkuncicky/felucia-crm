import { StavDealu, Technologie, ZakazkaStav } from '@prisma/client'

export const zakazkaStavLabels: Record<ZakazkaStav, string> = {
  NOVA: 'Nová',
  PRIRAZENA: 'Přiřazena',
  V_REALIZACI: 'V realizaci',
  PREDANA: 'Předána',
  VYUCTOVANA: 'Vyúčtována',
  HOTOVO: 'Hotovo',
}

export const stavLabels: Record<StavDealu, string> = {
  NOVY: 'Nový',
  JEDNANI: 'Jednání',
  NABIDKA: 'Nabídka',
  PRED_UZAVRENIM: 'Před uzavřením',
  USPECH: 'Úspěch',
  PAS: 'Prohráno',
  ZNEPLATNENO: 'Zneplatněno',
}

export const stavColors: Record<StavDealu, string> = {
  NOVY: 'bg-gray-100 text-gray-700',
  JEDNANI: 'bg-blue-100 text-blue-700',
  NABIDKA: 'bg-yellow-100 text-yellow-700',
  PRED_UZAVRENIM: 'bg-orange-100 text-orange-700',
  USPECH: 'bg-green-100 text-green-700',
  PAS: 'bg-red-100 text-red-700',
  ZNEPLATNENO: 'bg-gray-100 text-gray-500',
}

export const stavDotColors: Record<StavDealu, string> = {
  NOVY: 'bg-gray-400',
  JEDNANI: 'bg-blue-500',
  NABIDKA: 'bg-yellow-500',
  PRED_UZAVRENIM: 'bg-orange-500',
  USPECH: 'bg-green-500',
  PAS: 'bg-red-500',
  ZNEPLATNENO: 'bg-gray-400',
}

export const techLabels: Record<Technologie, string> = {
  KLIMA: 'Klimatizace',
  TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_TOPENI: 'Podlahové topení',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
  JINE: 'Jiné',
}

export const techColors: Record<Technologie, string> = {
  KLIMA: 'bg-blue-50 text-blue-700',
  TEPELNE_CERPADLO: 'bg-amber-50 text-amber-700',
  REKUPERACE: 'bg-teal-50 text-teal-700',
  PODLAHOVE_TOPENI: 'bg-orange-50 text-orange-700',
  VZDUCHOTECHNIKA: 'bg-purple-50 text-purple-700',
  JINE: 'bg-gray-50 text-gray-600',
}
