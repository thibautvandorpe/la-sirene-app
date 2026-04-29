'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function HouseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" />
      <path d="M4 12v8a1 1 0 001 1h14a1 1 0 001-1v-8" />
      <path d="M9 21V15h6v6" />
    </svg>
  )
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12l8.73-5.04" />
      <path d="M12 22V12" />
    </svg>
  )
}

function HangerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V5.5a2 2 0 012-2h.5" />
      <path d="M12 8L3 17h18L12 8z" />
    </svg>
  )
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
    </svg>
  )
}

const tabs = [
  { href: '/', label: 'Home', Icon: HouseIcon },
  { href: '/orders', label: 'Orders', Icon: PackageIcon },
  { href: '/wardrobe', label: 'Wardrobe', Icon: HangerIcon },
  { href: '/profile', label: 'Profile', Icon: PersonIcon },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#1c2b1e] border-t border-[#c4b89a]/20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center py-3 gap-1"
            >
              <Icon className={active ? 'text-[#c4b89a]' : 'text-[#f5f0e8]/30'} />
              <span
                className={`text-[9px] tracking-widest uppercase ${
                  active ? 'text-[#c4b89a]' : 'text-[#f5f0e8]/30'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
