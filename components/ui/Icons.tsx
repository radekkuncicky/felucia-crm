import type { SVGProps } from 'react'

function base(props: SVGProps<SVGSVGElement>) {
  return {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: props.className ?? 'w-5 h-5',
    ...props,
  }
}

export const IconClipboard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
)

export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
)

export const IconCoins = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
)

export const IconTrophy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 21h8m-4-4v4m-5.2-8.2A5 5 0 017 9V4h10v5a5 5 0 01-.8 3.8M7 6H4a1 1 0 00-1 1v1a4 4 0 004 4m10-6h3a1 1 0 011 1v1a4 4 0 01-4 4m-5 1a5 5 0 005-5" /></svg>
)

export const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
)

export const IconSnowflake = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3v18M5.5 6.5l13 11m0-11l-13 11M12 3l-2 2m2-2l2 2m-2 14l-2-2m2 2l2-2M5.5 6.5L8 7m-2.5-.5L5 9m13.5 8.5L16 17m2.5.5L19 15m-.5-8.5L16 7m2.5-.5L19 9M5.5 17.5L8 17m-2.5.5L5 15" /></svg>
)

export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
)

export const IconWind = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" /></svg>
)

export const IconHeat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 20h18M8 4c-1 2 1 3 0 5m4-5c-1 2 1 3 0 5m4-5c-1 2 1 3 0 5M5 13h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2a1 1 0 011-1z" /></svg>
)

export const IconFan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="2" /><path d="M12 10c0-3 1-6 4-6 2 0 3 1.5 3 3 0 2.5-3 3-7 3zm-2 2c-3 0-6 1-6 4 0 2 1.5 3 3 3 2.5 0 3-3 3-7zm2 2c0 3-1 6-4 6-2 0-3-1.5-3-3 0-2.5 3-3 7-3z" /></svg>
)

export const IconCog = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
)

export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
)

export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
)

export const IconHandshake = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 11.5L3.5 8 7 4.5M17 4.5L20.5 8 17 11.5M3.5 8h7m10 0h-7m-5 4l2.5 2.5a1.77 1.77 0 002.5-2.5M11 15l1.5 1.5a1.77 1.77 0 002.5-2.5m-7-1l3 3a1.77 1.77 0 01-2.5 2.5L7 17m5.5 2.5l-1-1" /></svg>
)

export const IconNote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
)

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
)

export const IconHammer = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M14.5 4.5l5 5L17 12l-5-5 2.5-2.5zM12 7L4 15l-1 4 4-1 8-8m-3-3l3 3" /></svg>
)

export const IconCreditCard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 10h18M7 15h2m4 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
)

export const IconSparkles = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 3v4M3 5h4m6-1l1.5 4.5L19 10l-4.5 1.5L13 16l-1.5-4.5L7 10l4.5-1.5L13 4zm5 11v3m-1.5-1.5h3M6 15l1 2.5L9.5 18 7 19l-1 2.5L5 19l-2.5-1L5 17.5 6 15z" /></svg>
)

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
)

export const IconBuilding = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-4a1 1 0 011-1h2a1 1 0 011 1v4m-4 0h4m-5-13h.01M9 11h.01M13 8h.01M13 11h.01" /></svg>
)

export const IconDocument = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
)

export const IconBox = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
)

export const IconMapPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
)

export const IconWrench = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
)

export const IconWarning = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
)

export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
)

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 18L18 6M6 6l12 12" /></svg>
)

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
)

export const IconActivity = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
)

export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
)

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
)

export const IconBriefcase = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
)

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
)

export const IconKey = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
)

export const IconWarehouse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 7l-8-4-8 4m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8 4-8-4m0 5l8 4 8-4" /></svg>
)

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
)

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M19 9l-7 7-7-7" /></svg>
)

export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 19l-7-7 7-7" /></svg>
)

export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 5l7 7-7 7" /></svg>
)

export const IconContract = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
)

export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
)
