// Ikony marketingového webu - vlastní SVG, 24x24, tah 1.75, barva z currentColor.

type IconProps = { className?: string; title?: string }

function Svg({ className, title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}

export const IconCheck = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const IconArrowRight = (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const IconPhone = (p: IconProps) => <Svg {...p}><path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 006 6l1.5-2L20 15.5V19a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" /></Svg>
export const IconNavigate = (p: IconProps) => <Svg {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></Svg>
export const IconCalendar = (p: IconProps) => <Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Svg>
export const IconUser = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></Svg>
export const IconBox = (p: IconProps) => <Svg {...p}><path d="M4 7.5L12 4l8 3.5v9L12 20l-8-3.5z" /><path d="M4 7.5l8 3.5 8-3.5M12 11v9" /></Svg>
export const IconCamera = (p: IconProps) => <Svg {...p}><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>
export const IconDoc = (p: IconProps) => <Svg {...p}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></Svg>
export const IconPen = (p: IconProps) => <Svg {...p}><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></Svg>
export const IconShield = (p: IconProps) => <Svg {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></Svg>
export const IconWrench = (p: IconProps) => <Svg {...p}><path d="M14.5 5.5a4 4 0 00-5 5L4 16l4 4 5.5-5.5a4 4 0 005-5l-2.5 2.5-2.5-.5-.5-2.5z" /></Svg>
export const IconChat = (p: IconProps) => <Svg {...p}><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-5 4z" /></Svg>
export const IconPause = (p: IconProps) => <Svg {...p}><path d="M9 6v12M15 6v12" /></Svg>
export const IconPlay = (p: IconProps) => <Svg {...p}><path d="M8 5.5v13l10.5-6.5z" /></Svg>
export const IconMessage = (p: IconProps) => <Svg {...p}><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M10 18h4" /></Svg>
export const IconList = (p: IconProps) => <Svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></Svg>
export const IconHome = (p: IconProps) => <Svg {...p}><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></Svg>
export const IconSun = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></Svg>
