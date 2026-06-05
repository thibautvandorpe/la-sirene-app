'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === '/'

  const [fullName, setFullName] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setFullName(null)
    setUnreadCount(0)
    setUnreadChatCount(0)
    setUserId(null)
    router.push('/')
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) {
          setLoaded(true)
          return
        }

        setLoggedIn(true)
        setUserId(session.user.id)

        const [{ data: clientData }, { count: notifCount }, { count: chatCount }] = await Promise.all([
          supabase.from('clients').select('full_name').eq('id', session.user.id).single(),
          supabase.from('notifications').select('*', { count: 'exact', head: true })
            .eq('client_id', session.user.id).is('read_at', null),
          supabase.from('chat_messages').select('*', { count: 'exact', head: true })
            .eq('client_id', session.user.id).eq('sender', 'team').is('read_at', null),
        ])

        setFullName(clientData?.full_name ?? null)
        setUnreadCount(notifCount ?? 0)
        setUnreadChatCount(chatCount ?? 0)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`header-icons-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `client_id=eq.${userId}` },
        () => setUnreadCount(prev => prev + 1)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `client_id=eq.${userId}` },
        () => {
          supabase.from('notifications').select('*', { count: 'exact', head: true })
            .eq('client_id', userId).is('read_at', null)
            .then(({ count }) => setUnreadCount(count ?? 0))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `client_id=eq.${userId}` },
        (payload) => {
          if ((payload.new as { sender: string }).sender === 'team') {
            setUnreadChatCount(prev => prev + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `client_id=eq.${userId}` },
        () => {
          supabase.from('chat_messages').select('*', { count: 'exact', head: true })
            .eq('client_id', userId).eq('sender', 'team').is('read_at', null)
            .then(({ count }) => setUnreadChatCount(count ?? 0))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  if (!loaded) return null

  const renderLeft = () => {
    if (!isHome) {
      return (
        <Image
          src="/logo.png"
          alt="La Sirène"
          width={36}
          height={36}
          className="mb-4"
        />
      )
    }
    if (loggedIn) {
      return (
        <div className="pb-4">
          <p className="text-[10px] tracking-wide uppercase text-[#c4b89a]/60">
            Welcome back
          </p>
          <p className="text-lg font-light text-[#c4b89a]">
            {fullName ?? ''}
          </p>
        </div>
      )
    }
    return (
      <div className="pb-4">
        <p className="font-serif text-xl text-[#f5f0e8]">La Sirène</p>
      </div>
    )
  }

  return (
    <header
      className="w-full bg-transparent px-6 flex items-end justify-between"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}
    >
      {renderLeft()}

      <div className="pb-4 flex items-center gap-4">
        {loggedIn && (
          <Link href="/profile/chat" className="relative" aria-label="Messages">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b89a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {unreadChatCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 text-[9px] font-medium rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#c4b89a', color: '#1c2b1e', minWidth: '16px', height: '16px', padding: '0 3px' }}
              >
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
          </Link>
        )}
        {loggedIn && (
          <Link href="/notifications" className="relative" aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b89a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 text-[9px] font-medium rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#c4b89a', color: '#1c2b1e', minWidth: '16px', height: '16px', padding: '0 3px' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        )}
        {loggedIn ? (
          <button
            onClick={handleSignOut}
            className="text-[10px] tracking-wide uppercase text-[#c4b89a] underline underline-offset-2 decoration-[#c4b89a]/40"
          >
            Sign Out
          </button>
        ) : (
          <Link
            href="/login"
            className="text-[10px] tracking-wide uppercase text-[#c4b89a] underline underline-offset-2 decoration-[#c4b89a]/40"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}
