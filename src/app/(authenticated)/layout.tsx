import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navigation from '@/components/navigation'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: teamMember } = await supabase
    .from('team_members')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!teamMember) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation isAdmin={teamMember.is_admin} />
      <main className="md:ml-56 pb-20 md:pb-6 p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
