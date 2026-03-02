// components/ui/PageSkeleton.tsx
// Used as loading.tsx content across all routes

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="h-8 w-48 rounded-xl skeleton" />
          <div className="h-3 w-32 rounded-lg skeleton mt-2" />
        </div>
        <div className="h-10 w-32 rounded-xl skeleton" />
      </div>

      <div className="page-body space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'rgba(15,61,30,0.1)' }}>
              <div className="h-3 w-20 rounded skeleton mb-3" />
              <div className="h-8 w-24 rounded-xl skeleton mb-2" />
              <div className="h-3 w-16 rounded skeleton" />
            </div>
          ))}
        </div>

        {/* Card with table */}
        <div className="card">
          <div className="card-header">
            <div className="h-5 w-28 rounded-lg skeleton" />
          </div>
          <div className="p-5 space-y-3">
            {[...Array(rows)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded skeleton" style={{ width: `${60 + (i % 3) * 15}%` }} />
                  <div className="h-3 rounded skeleton" style={{ width: `${30 + (i % 4) * 10}%` }} />
                </div>
                <div className="h-6 w-16 rounded-full skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Inline skeleton styles (add to globals.css)
// .skeleton { background: rgba(15,61,30,0.07); }
