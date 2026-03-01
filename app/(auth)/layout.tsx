import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-deep-900 via-forest-900 to-deep-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-earth-500 flex items-center justify-center font-bold text-white">S</div>
            <span className="text-white font-semibold text-xl">StokvelOS</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
