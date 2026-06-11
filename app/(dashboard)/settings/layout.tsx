import SettingsBreadcrumb from '@/components/SettingsBreadcrumb'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SettingsBreadcrumb />
      {children}
    </div>
  )
}
