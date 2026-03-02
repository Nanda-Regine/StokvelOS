'use client'
// components/reports/MemberStatementButton.tsx
// Generates a per-member PDF statement on demand

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, MONTHS_SHORT } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { StokvelMember } from '@/types'

interface MemberStatementButtonProps {
  member:     StokvelMember
  stokvelId:  string
  stokvelName: string
  size?:      'sm' | 'md'
  label?:     string
}

export function MemberStatementButton({
  member,
  stokvelId,
  stokvelName,
  size = 'sm',
  label = '↓ Statement',
}: MemberStatementButtonProps) {
  const [loading, setLoading] = useState(false)

  async function generateStatement() {
    setLoading(true)
    try {
      // Fetch statement data from API
      const res  = await fetch(`/api/statements?memberId=${member.id}&stokvelId=${stokvelId}`)
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }

      const { contributions, payouts, summary, generatedAt } = json

      // Dynamic import jsPDF
      const { default: jsPDF }      = await import('jspdf')
      const { default: autoTable }  = await import('jspdf-autotable')

      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()

      // ── Header ──────────────────────────────────────────────
      doc.setFillColor(10, 36, 18)
      doc.rect(0, 0, pageW, 48, 'F')

      doc.setTextColor(202, 138, 4)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('MEMBER CONTRIBUTION STATEMENT', 15, 16)

      doc.setTextColor(254, 249, 195)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text(member.name, 15, 27)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(202, 138, 4)
      doc.text(stokvelName, 15, 35)

      doc.setTextColor(254, 249, 195)
      doc.setFontSize(8)
      doc.text(`Generated: ${new Date(generatedAt).toLocaleDateString('en-ZA')}`, 15, 43)

      // ── Summary boxes ───────────────────────────────────────
      let y = 58
      const boxes = [
        { label: 'Total Contributed', value: formatCurrency(summary.totalConfirmed) },
        { label: 'Total Received',    value: formatCurrency(summary.totalPaid)      },
        { label: 'Balance',           value: formatCurrency(summary.balance)        },
        { label: 'Payments Made',     value: String(summary.paymentCount)           },
      ]

      const boxW = (pageW - 30) / 4
      boxes.forEach((b, i) => {
        const x = 15 + i * (boxW + 2)
        doc.setFillColor(248, 250, 248)
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'F')
        doc.setTextColor(153, 153, 153)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(b.label.toUpperCase(), x + 4, y + 7)
        doc.setTextColor(10, 36, 18)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(b.value, x + 4, y + 14)
      })

      // ── Member details ──────────────────────────────────────
      y += 26
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 36, 18)
      doc.text('Member Details', 15, y)
      y += 4

      const details = [
        ['Email',            member.email  || '—'],
        ['Phone',            member.phone  || '—'],
        ['Monthly Amount',   formatCurrency(member.monthly_amount || 0)],
        ['Payout Position',  member.payout_position ? `#${member.payout_position}` : '—'],
        ['Status',           member.status],
        ['Role',             member.role],
      ]

      autoTable(doc, {
        startY:  y,
        head:    [],
        body:    details,
        theme:   'plain',
        styles:  { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, textColor: [107,114,128] } },
        margin:  { left: 15, right: 15 },
      })

      // ── Contribution history ────────────────────────────────
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 36, 18)
      doc.text('Contribution History', 15, y)
      y += 4

      if (contributions.length > 0) {
        const rows = contributions.map((c: { date: string; amount: number; method: string; status: string; notes: string }) => [
          formatDate(c.date),
          formatCurrency(Number(c.amount)),
          c.method.toUpperCase(),
          c.status,
          c.notes || '—',
        ])

        autoTable(doc, {
          startY: y,
          head:   [['Date', 'Amount', 'Method', 'Status', 'Notes']],
          body:   rows,
          theme:  'striped',
          headStyles: { fillColor: [10, 36, 18], textColor: [254, 249, 195], fontSize: 9 },
          bodyStyles:  { fontSize: 9 },
          columnStyles: { 1: { halign: 'right' } },
          margin: { left: 15, right: 15 },
        })
      } else {
        doc.setFontSize(9)
        doc.setTextColor(153, 153, 153)
        doc.text('No contributions recorded.', 15, y + 6)
      }

      // ── Payouts received ────────────────────────────────────
      if (payouts.length > 0) {
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(10, 36, 18)
        doc.text('Payouts Received', 15, y)
        y += 4

        autoTable(doc, {
          startY: y,
          head:   [['Date', 'Amount', 'Status', 'Notes']],
          body:   payouts.map((p: { date: string; amount: number; status: string; notes: string }) => [
            formatDate(p.date), formatCurrency(Number(p.amount)), p.status, p.notes || '—',
          ]),
          theme:  'striped',
          headStyles: { fillColor: [202, 138, 4], textColor: [10, 36, 18], fontSize: 9 },
          bodyStyles:  { fontSize: 9 },
          columnStyles: { 1: { halign: 'right' } },
          margin: { left: 15, right: 15 },
        })
      }

      // ── Footer ──────────────────────────────────────────────
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(180, 180, 180)
        doc.text(`StokvelOS  ·  ${stokvelName}  ·  ${member.name}  ·  Page ${i} of ${pages}`, 15, 290)
        doc.text('This statement is for record-keeping purposes only.', pageW - 15, 290, { align: 'right' })
      }

      doc.save(`${member.name.replace(/\s+/g, '_')}_Statement.pdf`)
      toast.success('Statement downloaded! 📄')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate statement.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size={size} onClick={generateStatement} loading={loading}>
      {label}
    </Button>
  )
}
