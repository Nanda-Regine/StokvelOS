'use client'
// components/settings/ConstitutionSection.tsx
// Used inside SettingsClient — the Constitution tab

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import type { Stokvel } from '@/types'

interface ConstitutionSectionProps {
  stokvel: Stokvel
}

export function ConstitutionSection({ stokvel }: ConstitutionSectionProps) {
  const [generating,    setGenerating]    = useState(false)
  const [constitution,  setConstitution]  = useState<string>(
    (stokvel as Stokvel & { constitution?: string }).constitution || ''
  )
  const [tab, setTab] = useState<'view' | 'raw'>('view')

  async function handleGenerate() {
    if (constitution && !confirm('This will replace the existing constitution. Continue?')) return
    setGenerating(true)
    try {
      const res  = await fetch('/api/ai/constitution', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stokvelId: stokvel.id }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setConstitution(json.constitution)
      toast.success('Constitution generated! 📜')
    } catch {
      toast.error('Failed to generate.')
    } finally {
      setGenerating(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(constitution)
    toast.success('Copied to clipboard!')
  }

  function downloadTxt() {
    const blob = new Blob([constitution], { type: 'text/plain' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${stokvel.name.replace(/\s+/g, '_')}_Constitution.txt`
    a.click()
  }

  async function downloadPdf() {
    try {
      const { default: jsPDF }     = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()

      // Cover
      doc.setFillColor(10, 36, 18)
      doc.rect(0, 0, pageW, 60, 'F')
      doc.setTextColor(254, 249, 195)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('CONSTITUTION', pageW / 2, 28, { align: 'center' })
      doc.setFontSize(13)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(202, 138, 4)
      doc.text(stokvel.name.toUpperCase(), pageW / 2, 40, { align: 'center' })
      doc.setFontSize(9)
      doc.setTextColor(254, 249, 195)
      doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, pageW / 2, 52, { align: 'center' })

      // Content
      const lines  = doc.splitTextToSize(constitution, pageW - 30)
      let y        = 74
      const lineH  = 5.2

      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)

      for (const line of lines) {
        if (y > 275) {
          doc.addPage()
          y = 20
        }
        // Section headers in bold
        if (/^\d+\./.test(line.trim())) {
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(10, 36, 18)
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(30, 30, 30)
        }
        doc.text(line, 15, y)
        y += lineH
      }

      // Footer
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(7.5)
        doc.setTextColor(180, 180, 180)
        doc.text(`${stokvel.name} Constitution  ·  Page ${i} of ${pages}`, 15, 290)
      }

      doc.save(`${stokvel.name.replace(/\s+/g, '_')}_Constitution.pdf`)
      toast.success('Constitution PDF downloaded!')
    } catch {
      toast.error('PDF generation failed.')
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(15,61,30,0.96), rgba(10,36,18,0.98))', border: '1px solid rgba(202,138,4,0.2)' }}
      >
        <div className="text-2xl flex-shrink-0">📜</div>
        <div>
          <p className="font-display text-base mb-1" style={{ color: '#fef9c3' }}>
            AI Constitution Generator
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(254,249,195,0.65)' }}>
            Generate a formal, legally-aware stokvel constitution in seconds. Based on your stokvel settings, members, payout rules, and South African law.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="gold" size="md" onClick={handleGenerate} loading={generating}>
          {constitution ? '↻ Regenerate Constitution' : '✨ Generate Constitution'}
        </Button>
        {constitution && (
          <>
            <Button variant="outline" size="md" onClick={copyToClipboard}>📋 Copy</Button>
            <Button variant="outline" size="md" onClick={downloadTxt}>↓ .txt</Button>
            <Button variant="primary" size="md" onClick={downloadPdf}>↓ PDF</Button>
          </>
        )}
      </div>

      {constitution ? (
        <>
          {/* Tabs */}
          <div className="flex gap-1">
            {(['view', 'raw'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: tab === t ? '#0f3d1e' : 'rgba(15,61,30,0.05)',
                  color:      tab === t ? '#fef9c3' : '#6b7280',
                }}
              >
                {t === 'view' ? '📜 Formatted' : '📝 Plain text'}
              </button>
            ))}
          </div>

          <div
            className="rounded-xl p-5 text-sm leading-relaxed overflow-y-auto"
            style={{
              background:  'rgba(248,250,248,0.8)',
              border:      '1px solid rgba(15,61,30,0.08)',
              maxHeight:   '520px',
              whiteSpace:  tab === 'raw' ? 'pre-wrap' : 'pre-wrap',
              fontFamily:  tab === 'raw' ? 'var(--font-mono)' : 'var(--font-body)',
              fontSize:    tab === 'raw' ? '0.75rem' : '0.875rem',
              color:       '#374151',
            }}
          >
            {constitution.split('\n').map((line, i) => {
              const isSectionHeader = /^\d+\./.test(line.trim()) && tab === 'view'
              const isTitle         = /^[A-Z\s]{5,}$/.test(line.trim()) && tab === 'view'
              return (
                <div
                  key={i}
                  style={{
                    fontWeight:   isSectionHeader || isTitle ? 700 : 400,
                    color:        isTitle ? '#0a2412' : isSectionHeader ? '#0f3d1e' : '#374151',
                    marginTop:    isSectionHeader ? '12px' : 0,
                    fontSize:     isTitle ? '1rem' : undefined,
                  }}
                >
                  {line || '\u00A0'}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div
          className="rounded-xl p-8 flex items-center justify-center"
          style={{ background: 'rgba(248,250,248,0.6)', border: '1px dashed rgba(15,61,30,0.15)', minHeight: '120px' }}
        >
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            Your constitution will appear here after generation.
          </p>
        </div>
      )}
    </div>
  )
}
