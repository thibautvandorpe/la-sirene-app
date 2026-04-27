'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

export default function ProfilePage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Display values
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setLoggedIn(false)
        setLoaded(true)
        return
      }

      setLoggedIn(true)
      setEmail(session.user.email ?? '')

      const { data } = await supabase
        .from('clients')
        .select('full_name, phone')
        .eq('id', session.user.id)
        .maybeSingle()

      if (data) {
        setFullName(data.full_name ?? '')
        setPhone(data.phone ?? '')
      }

      setLoaded(true)
    })
  }, [])

  function handleStartEdit() {
    setEditName(fullName)
    setEditPhone(phone)
    setSaveError(null)
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      const { error } = await supabase
        .from('clients')
        .update({ full_name: editName.trim() || null, phone: editPhone.trim() || null })
        .eq('id', session.user.id)

      if (error) throw error

      setFullName(editName.trim())
      setPhone(editPhone.trim())
      setEditing(false)
    } catch {
      setSaveError('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-light tracking-wide" style={{ color: '#f5f0e8' }}>
            Please sign in to access your profile
          </p>
          <Link
            href="/login"
            className="mt-5 px-6 py-2 text-[10px] tracking-widest uppercase"
            style={{ color: '#c4b89a', border: '1px solid rgba(196,184,154,0.3)' }}
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1c2b1e' }}>
      <AppHeader />

      <main className="flex-1 px-6 pt-4 pb-24">

        {/* Page title row */}
        <div className="flex items-center justify-between mb-10">
          <p className="text-[10px] tracking-[0.35em] uppercase" style={{ color: '#c4b89a' }}>
            My Profile
          </p>
          {!editing && (
            <button
              onClick={handleStartEdit}
              className="text-[10px] tracking-[0.25em] uppercase font-light"
              style={{ color: 'rgba(196,184,154,0.6)' }}
            >
              Edit
            </button>
          )}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-8">

          {/* Full Name */}
          <div>
            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
              Full Name
            </label>
            {editing ? (
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{
                  color: '#f5f0e8',
                  borderBottom: '1px solid rgba(196,184,154,0.5)',
                }}
              />
            ) : (
              <p className="text-sm font-light pb-3" style={{
                color: fullName ? '#f5f0e8' : 'rgba(245,240,232,0.3)',
                borderBottom: '1px solid rgba(196,184,154,0.15)',
              }}>
                {fullName || 'Not set'}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
              Phone Number
            </label>
            {editing ? (
              <input
                type="tel"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                placeholder="e.g. +1 310 555 0100"
                className="w-full bg-transparent outline-none text-sm font-light pb-3 placeholder:text-[rgba(245,240,232,0.25)]"
                style={{
                  color: '#f5f0e8',
                  borderBottom: '1px solid rgba(196,184,154,0.5)',
                }}
              />
            ) : (
              <p className="text-sm font-light pb-3" style={{
                color: phone ? '#f5f0e8' : 'rgba(245,240,232,0.3)',
                borderBottom: '1px solid rgba(196,184,154,0.15)',
              }}>
                {phone || 'Not set'}
              </p>
            )}
          </div>

          {/* Email — always read-only */}
          <div>
            <label className="block text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: '#c4b89a' }}>
              Email{' '}
              <span style={{ color: 'rgba(196,184,154,0.4)', textTransform: 'none', letterSpacing: 0 }}>
                (cannot be changed)
              </span>
            </label>
            <p
              className="text-sm font-light pb-3"
              style={{
                color: 'rgba(245,240,232,0.4)',
                borderBottom: '1px solid rgba(196,184,154,0.1)',
              }}
            >
              {email}
            </p>
          </div>

        </div>

        {/* Save / Cancel — only shown in edit mode */}
        {editing && (
          <div className="flex flex-col gap-3 mt-10">
            {saveError && (
              <p className="text-sm font-light text-center" style={{ color: '#e8a090' }}>
                {saveError}
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 text-[10px] tracking-[0.35em] uppercase font-medium disabled:opacity-40"
              style={{ backgroundColor: '#c4b89a', color: '#1c2b1e' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="w-full py-3 text-[10px] tracking-[0.3em] uppercase font-light disabled:opacity-40"
              style={{ color: 'rgba(196,184,154,0.45)' }}
            >
              Cancel
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
