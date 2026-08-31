import BottomNav from '@/components/BottomNav'
import CleanCloudSync from '@/components/CleanCloudSync'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F0ED]">
      <div className="mx-auto w-full" style={{ maxWidth: '430px' }}>
        <main className="pb-24">{children}</main>
      </div>
      <BottomNav />
      <CleanCloudSync />
    </div>
  )
}
