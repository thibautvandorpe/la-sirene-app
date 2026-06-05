'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  client_id: string
  type: string
  title: string
  body: string
  read_at: string | null
  order_id: string | null
  created_at: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (day.getTime() === today.getTime()) return 'Today'
  if (day.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const groups: { label: string; items: Notification[] }[] = []
  const seen = new Map<string, number>()
  for (const n of notifications) {
    const label = dateLabel(n.created_at)
    if (!seen.has(label)) {
      seen.set(label, groups.length)
      groups.push({ label, items: [] })
    }
    groups[seen.get(label)!].items.push(n)
  }
  return groups
}

export default function NotificationsPage() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('client_id', session.user.id)
        .order('created_at', { ascending: false })

      setNotifications((data as Notification[]) ?? [])

      // Mark all unread as read
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('client_id', session.user.id)
        .is('read_at', null)

      setLoaded(true)
    })
  }, [router])

  if (!loaded) return null

  const groups = groupByDate(notifications)

  function handleTap(n: Notification) {
    if (n.order_id) {
      router.push(`/orders/order/${n.order_id}`)
    } else if (n.type === 'chat_message') {
      router.push('/profile/chat')
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-5 shrink-0"
        style={{
          borderBottom: '1px solid rgba(196,184,154,0.1)',
          paddingTop: 'max(env(safe-area-inset-top), 20px)',
        }}
      >
        <button onClick={() => router.back()} style={{ color: '#c4b89a', fontSize: '1.125rem' }}>←</button>
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>
            La Sirène
          </p>
          <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>Notifications</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {notifications.length === 0 ? (
          <p className="text-sm font-light text-center mt-16" style={{ color: 'rgba(245,240,232,0.3)' }}>
            No notifications yet.
          </p>
        ) : (
          <div className="flex flex-col gap-8 max-w-2xl">
            {groups.map(group => (
              <div key={group.label}>
                <p
                  className="text-[10px] tracking-[0.35em] uppercase mb-3"
                  style={{ color: 'rgba(196,184,154,0.5)' }}
                >
                  {group.label}
                </p>
                <div className="flex flex-col" style={{ borderTop: '1px solid rgba(196,184,154,0.1)' }}>
                  {group.items.map(n => {
                    const isUnread = !n.read_at
                    const tappable = !!n.order_id || n.type === 'chat_message'
                    return (
                      <div
                        key={n.id}
                        onClick={() => tappable && handleTap(n)}
                        className="flex items-start gap-4 py-4"
                        style={{
                          borderBottom: '1px solid rgba(196,184,154,0.1)',
                          borderLeft: isUnread ? '2px solid rgba(196,184,154,0.6)' : '2px solid transparent',
                          paddingLeft: '12px',
                          cursor: tappable ? 'pointer' : 'default',
                        }}
                      >
                        <span className="text-base shrink-0 mt-0.5">
                          {n.type === 'order_status' ? '📦' : '💬'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>{n.title}</p>
                          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(245,240,232,0.5)' }}>{n.body}</p>
                        </div>
                        <p className="text-[10px] shrink-0 mt-0.5" style={{ color: 'rgba(196,184,154,0.4)' }}>
                          {formatTime(n.created_at)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
