import type { NavIconKey } from '@/lib/navigation'
import {
  IconHome, IconCalendar, IconUsers, IconBell, IconBriefcase, IconDocument, IconClipboard, IconWarehouse,
  IconWrench, IconChart, IconBox, IconActivity, IconContract, IconCog, IconKey, IconMapPin,
} from '@/components/ui/Icons'

function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

const ICONS: Record<NavIconKey, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  home: IconHome, calendar: IconCalendar, users: IconUsers, bell: IconBell, briefcase: IconBriefcase,
  document: IconDocument, clipboard: IconClipboard, warehouse: IconWarehouse, wrench: IconWrench,
  chart: IconChart, box: IconBox, activity: IconActivity, contract: IconContract, cog: IconCog,
  folder: IconDocument, key: IconKey, plus: IconPlus, mapPin: IconMapPin,
}

/** Ikona položky navigace podle klíče z lib/navigation.ts */
export function NavIcon({ name, className = 'w-5 h-5 flex-shrink-0' }: { name: NavIconKey; className?: string }) {
  const Icon = ICONS[name]
  return <Icon className={className} aria-hidden />
}
