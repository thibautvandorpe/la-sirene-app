'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function AdminConversationPage() {
  const router = useRouter()
  const { clientId } = useParams<{ clientId: string }>()
  const [loaded, setLoaded] = useState(false)
  const [clientName, setClientName] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: adminClient } = await supabase
        .from('clients')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (adminClient?.role !== 'admin') { router.replace('/'); return }

      const [{ data: clientData }, { data: msgs }] = await Promise.all([
        supabase.from('clients').select('full_name').eq('id', clientId).single(),
        supabase
          .from('chat_messages')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true }),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setClientName((clientData as any)?.full_name ?? 'Client')
      setMessages((msgs as ChatMessage[]) ?? [])

      // Mark all unread client messages as read
      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('sender', 'client')
        .is('read_at', null)

      setLoaded(true)
    })
  }, [router, clientId])

  useEffect(() => {
    if (!clientId) return

    const channel = supabase
      .channel(`admin-chat-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages(prev =>
            prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]
          )
          // Mark incoming client messages as read immediately
          if (newMsg.sender === 'client') {
            supabase
              .from('chat_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .then(() => {})
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    await supabase.from('chat_messages').insert({
      client_id: clientId,
      sender: 'team',
      content,
    })
    setSending(false)
  }

  if (!loaded) return null

  return (
    <div className="flex flex-col" style={{ backgroundColor: '#1c2b1e', height: '100dvh' }}>

      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-5 shrink-0"
        style={{ borderBottom: '1px solid rgba(196,184,154,0.1)' }}
      >
        <Link href="/admin/conversations" style={{ color: '#c4b89a', fontSize: '1.125rem' }}>←</Link>
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(196,184,154,0.5)' }}>
            Conversation
          </p>
          <p className="text-sm font-light" style={{ color: '#f5f0e8' }}>{clientName}</p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <p className="text-sm font-light text-center mt-10" style={{ color: 'rgba(245,240,232,0.3)' }}>
            No messages yet.
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'team' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[75%] px-4 py-3 text-sm font-light"
              style={msg.sender === 'team'
                ? { backgroundColor: '#c4b89a', color: '#1c2b1e', borderRadius: '12px 12px 2px 12px' }
                : { backgroundColor: 'rgba(245,240,232,0.06)', color: '#f5f0e8', border: '1px solid rgba(196,184,154,0.12)', borderRadius: '12px 12px 12px 2px' }
              }
            >
              {msg.sender === 'client' && (
                <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: '#c4b89a' }}>{clientName}</p>
              )}
              <p>{msg.content}</p>
              <p
                className="text-[10px] mt-1.5"
                style={{
                  color: msg.sender === 'team' ? 'rgba(28,43,30,0.45)' : 'rgba(245,240,232,0.35)',
                  textAlign: msg.sender === 'team' ? 'right' : 'left',
                }}
              >
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="px-6 py-4 flex items-center gap-3 shrink-0"
        style={{ borderTop: '1px solid rgba(196,184,154,0.1)', backgroundColor: '#1c2b1e' }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder="Reply…"
          className="flex-1 bg-transparent outline-none text-sm font-light placeholder:text-[rgba(245,240,232,0.2)]"
          style={{ color: '#f5f0e8' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="text-[10px] tracking-[0.25em] uppercase font-light px-4 py-2 disabled:opacity-30 shrink-0"
          style={{ color: '#c4b89a', border: '1px solid rgba(196,184,154,0.3)' }}
        >
          Send
        </button>
      </div>

    </div>
  )
}
