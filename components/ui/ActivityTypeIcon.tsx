import { IconPhone, IconMail, IconHandshake, IconNote, IconCheck } from '@/components/ui/Icons'

/**
 * Jednotná ikona typu aktivity (HOVOR/EMAIL/SCHUZKA/POZNAMKA/UKOL).
 * Nahrazuje dřívější emoji mapy (📞 ✉️ 🤝 📝 ✅) — SVG respektuje barvu,
 * dark mode a vypadá stejně na všech OS.
 */
export function ActivityTypeIcon({ typ, className = 'w-4 h-4' }: { typ: string; className?: string }) {
  switch (typ) {
    case 'HOVOR':
      return <IconPhone className={`${className} text-sky-500`} />
    case 'EMAIL':
      return <IconMail className={`${className} text-violet-500`} />
    case 'SCHUZKA':
      return <IconHandshake className={`${className} text-amber-500`} />
    case 'UKOL':
      return <IconCheck className={`${className} text-primary`} />
    case 'POZNAMKA':
    default:
      return <IconNote className={`${className} text-gray-400`} />
  }
}
