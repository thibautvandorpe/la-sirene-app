import AppHeader from '@/components/AppHeader'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <AppHeader />
      {/* Hero */}
      <section className="flex flex-col items-center px-8 text-center pt-10 pb-14">
        <Image
          src="/logo.png"
          alt="La Sirène"
          width={140}
          height={140}
          className="mb-8"
          priority
        />
        <p className="text-[10px] tracking-[0.4em] uppercase text-[#c4b89a] mb-6">
          Est. 2024
        </p>
        <h1
          className="text-6xl text-[#f5f0e8] mb-6 leading-none"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 300 }}
        >
          La Sirène
        </h1>
        <div className="w-10 border-t border-[#c4b89a]/50 mb-6" />
        <p className="text-base font-light tracking-[0.15em] text-[#f5f0e8]/60">
          The Spa for your Clothes
        </p>
      </section>

      {/* Services */}
      <section className="px-6 pt-2 pb-6">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[#c4b89a] mb-6">
          Our Services
        </p>
        <div className="flex flex-col gap-3">
          <div className="border border-[#c4b89a]/15 rounded-sm p-6 bg-white/[0.03]">
            <div className="w-4 border-t border-[#c4b89a]/50 mb-4" />
            <h3 className="text-sm font-light tracking-widest uppercase text-[#f5f0e8] mb-3">
              Expert Garment Care
            </h3>
            <p className="text-sm font-light leading-relaxed text-[#f5f0e8]/50">
              Meticulous cleaning, restoration, and alteration by artisans who treat each piece as a singular creation. From couture gowns to heirloom textiles.
            </p>
          </div>
          <div className="border border-[#c4b89a]/15 rounded-sm p-6 bg-white/[0.03]">
            <div className="w-4 border-t border-[#c4b89a]/50 mb-4" />
            <h3 className="text-sm font-light tracking-widest uppercase text-[#f5f0e8] mb-3">
              Digital Wardrobe
            </h3>
            <p className="text-sm font-light leading-relaxed text-[#f5f0e8]/50">
              Your personal digital inventory, enriched with a complete care history for every garment. Know exactly what you own and how it has been cared for.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
