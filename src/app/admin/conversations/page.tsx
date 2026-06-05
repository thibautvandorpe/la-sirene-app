'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ChatMessage = {
  id: string
  client_id: string
  sender: string
  content: string
  created_at: string
  read_at: string | null
}

type ConversationRow = {
  clientId: string
  clientName: string
  lastMessage: ChatMessage
  unreadCount: number
}

export default function ConversationsPage() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [conversations, setConversations] = useState<ConversationRow[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: client } = await supabase
        .from('clients')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (client?.role !== 'admin') { router.replace('/'); return }

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })

      const allMessages = (msgs as ChatMessage[]) ?? []

      // Group by client_id: last message and unread count
      const grouped = new Map<string, { lastMessage: ChatMessage; unreadCount: number }>()
      for (const msg of allMessages) {
        if (!grouped.has(msg.client_id)) {
          grouped.set(msg.client_id, { lastMessage: msg, unreadCount: 0 })
        }
        if (msg.sender === 'client' && !msg.read_at) {
          grouped.get(msg.client_id)!.unreadCount++
        }
      }

      if (grouped.size === 0) {
        setLoaded(true)
        return
      }

      const clientIds = Array.from(grouped.keys())
      const { data: clients } = await supabase
        .from('clients')
        .select('id, full_name')
        .in('id', clientIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientNameMap = new Map<string, string>((clients as any[])?.map((c: any) => [c.id, c.full_name ?? 'Unknown']) ?? [])

      const rows: ConversationRow[] = clientIds.map(id => ({
        clientId: id,
        clientName: clientNameMap.get(id) ?? 'Unknown',
        lastMessage: grouped.get(id)!.lastMessage,
        unreadCount: grouped.get(id)!.unreadCount,
      }))

      // Sort by last message date descending within each group
      const byRecent = (a: ConversationRow, b: ConversationRow) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()

      rows.sort(byRecent)

      setConversations(rows)
      setLoaded(true)
    })
  }, [router])

  if (!loaded) return null

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#1c2b1e' }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <Link href="/admin" className="text-lg" style={{ color: '#c4b89a' }}>←</Link>
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>
            La Sirène
          </p>
          <h1 className="text-2xl font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            Conversations
          </h1>
        </div>
      </div>

      {conversations.length === 0 ? (
        <p className="text-sm font-light" style={{ color: 'rgba(245,240,232,0.3)' }}>
          No conversations yet.
        </p>
      ) : (() => {
        const unread = conversations.filter(r => r.unreadCount > 0)
        const read = conversations.filter(r => r.unreadCount === 0)
        const hasBoth = unread.length > 0 && read.length > 0

        const renderRows = (rows: ConversationRow[]) => rows.map(row => (
          <Link
            key={row.clientId}
            href={`/admin/conversations/${row.clientId}`}
            className="flex items-center justify-between py-5 transition-opacity hover:opacity-70"
            style={{ borderBottom: '1px solid rgba(196,184,154,0.1)' }}
          >
            <div className="flex flex-col gap-1 flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-3">
                <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>{row.clientName}</p>
                {row.unreadCount > 0 && (
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: '#c87a3a', color: '#f5f0e8', minWidth: '18px', textAlign: 'center' }}
                  >
                    {row.unreadCount}
                  </span>
                )}
              </div>
              <p
                className="text-xs font-light truncate"
                style={{ color: 'rgba(245,240,232,0.4)' }}
              >
                {row.lastMessage.sender === 'team' ? 'You: ' : ''}{row.lastMessage.content}
              </p>
            </div>
            <span className="text-sm shrink-0" style={{ color: 'rgba(196,184,154,0.4)' }}>→</span>
          </Link>
        ))

        return (
          <div className="flex flex-col max-w-2xl">
            {unread.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[0.35em] uppercase pb-2 pt-1" style={{ color: 'rgba(196,184,154,0.5)' }}>
                  Unread
                </p>
                <div style={{ borderTop: '1px solid rgba(196,184,154,0.1)' }}>
                  {renderRows(unread)}
                </div>
              </div>
            )}
            {hasBoth && <div className="mt-8" />}
            {read.length > 0 && (
              <div>
                {hasBoth && (
                  <p className="text-[10px] tracking-[0.35em] uppercase pb-2 pt-1" style={{ color: 'rgba(196,184,154,0.5)' }}>
                    All Conversations
                  </p>
                )}
                <div style={{ borderTop: '1px solid rgba(196,184,154,0.1)' }}>
                  {renderRows(read)}
                </div>
              </div>
            )}
          </div>
        )
      })()}

    </main>
  )
}
