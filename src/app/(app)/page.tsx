import AppHeader from '@/components/AppHeader'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <AppHeader />

      {/* Hero */}
      <section className="px-[22px] pt-4 pb-8">
        <div
          className="relative overflow-hidden"
          style={{
            height: '392px',
            borderRadius: '9999px 9999px 4px 4px',
          }}
        >
          {/* Photo */}
          <img
            src="/hero-boutique.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: 'cover',
              objectPosition: '52% 46%',
              filter: 'saturate(.92)',
            }}
          />

          {/* Inner hairline arch */}
          <div
            className="absolute pointer-events-none"
            style={{
              inset: '9px',
              borderRadius: '9999px 9999px 3px 3px',
              border: '1px solid rgba(255,255,255,.5)',
            }}
          />

          {/* Gradient veil */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(20,27,69,0) 0%, rgba(20,27,69,.06) 44%, rgba(20,27,69,.62) 100%)',
            }}
          />

          {/* Text block — centred, 30px from bottom */}
          <div
            className="absolute left-0 right-0 flex flex-col items-center gap-2"
            style={{ bottom: '30px' }}
          >
            <Image
              src="/wordmark.png"
              alt="La Sirène"
              width={206}
              height={52}
              style={{ objectFit: 'contain' }}
              priority
            />
            <p
              className="text-[10px] uppercase"
              style={{ letterSpacing: '.3em', color: 'rgba(255,255,255,.82)' }}
            >
              The Spa for Your Clothes
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 pt-2 pb-6">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[#9A7532] mb-6">
          Our Services
        </p>
        <div className="flex flex-col gap-3">
          <div className="border border-[#9A7532]/15 rounded-sm p-6 bg-white/[0.03]">
            <div className="w-4 border-t border-[#9A7532]/50 mb-4" />
            <h3 className="text-sm font-light tracking-widest uppercase text-[#141B45] mb-3">
              Expert Garment Care
            </h3>
            <p className="text-sm font-light leading-relaxed text-[#141B45]/50">
              Meticulous cleaning, restoration, and alteration by artisans who treat each piece as a singular creation. From couture gowns to heirloom textiles.
            </p>
          </div>
          <div className="border border-[#9A7532]/15 rounded-sm p-6 bg-white/[0.03]">
            <div className="w-4 border-t border-[#9A7532]/50 mb-4" />
            <h3 className="text-sm font-light tracking-widest uppercase text-[#141B45] mb-3">
              Digital Wardrobe
            </h3>
            <p className="text-sm font-light leading-relaxed text-[#141B45]/50">
              Your personal digital inventory, enriched with a complete care history for every garment. Know exactly what you own and how it has been cared for.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
