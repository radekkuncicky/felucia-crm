import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'
import CalendarSubscribeCard from './CalendarSubscribeCard'
import { getCalendarToken } from '@/lib/calendarToken'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, jmeno: true, email: true, telefon: true, role: true, avatar: true, vytvoreno: true,
      organization: { select: { nazev: true } } },
  })
  if (!user) redirect('/login')

  const userId = session.user.id
  const sig = getCalendarToken(userId)
  const host = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).host
    : 'app.felucia.io'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const subscribeUrl = `${proto}://${host}/api/calendar/ics?uid=${userId}&sig=${sig}`
  const webcalUrl = `webcal://${host}/api/calendar/ics?uid=${userId}&sig=${sig}`

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Můj profil</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Spravujte své osobní údaje a nastavení zabezpečení.</p>
      </div>
      <ProfileClient user={{ ...user, vytvoreno: user.vytvoreno.toISOString() }} />
      <CalendarSubscribeCard subscribeUrl={subscribeUrl} webcalUrl={webcalUrl} />
    </div>
  )
}
