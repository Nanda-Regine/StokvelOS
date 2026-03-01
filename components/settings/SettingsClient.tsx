'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SA_PROVINCES, STOKVEL_TYPE_ICONS, formatDate, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Stokvel, StokvelType, PayoutFrequency } from '@/types'
import Link from 'next/link'

const STOKVEL_TYPES: StokvelType[] = ['general', 'grocery', 'burial', 'investment', 'christmas', 'other']
const PAYOUT_FREQS: PayoutFrequency[] = ['monthly', 'quarterly', 'annually']

interface SettingsClientProps {
  stokvel:      Stokvel | null
  profile:      Record<string, unknown> | null
  subscription: Record<string, unknown> | null
  userId:       string
  userEmail:    string
}

type SectionKey = 'stokvel' | 'profile' | 'subscription' | 'danger'

export function SettingsClient({ stokvel, profile, subscription, userId, userEmail }: SettingsClientProps) {
  const router  = useRouter()
  const [active, setActive] = useState<SectionKey>('stokvel')

  // Stokvel fields
  const [stokvelName,   setStokvelName]   = useState(stokvel?.name || '')
  const [stokvelType,   setStokvelType]   = useState<StokvelType>(stokvel?.type || 'general')
  const [province,      setProvince]      = useState(stokvel?.province || '')
  const [description,   setDescription]   = useState(stokvel?.description || '')
  const [monthlyAmount, setMonthlyAmount] = useState(String(stokvel?.monthly_amount || ''))
  const [payoutFreq,    setPayoutFreq]    = useState<PayoutFrequency>(stokvel?.payout_frequency || 'monthly')
  const [savingStokvel, setSavingStokvel] = useState(false)

  // Profile fields
  const [fullName,     setFullName]     = useState(String(profile?.full_name || ''))
  const [phone,        setPhone]        = useState(String(profile?.phone || ''))
  const [savingProfile, setSavingProfile] = useState(false)

  // Password fields
  const [currentPw,   setCurrentPw]   = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [savingPw,    setSavingPw]    = useState(false)

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting,      setDeleting]      = useState(false)

  async function saveStokvel() {
    if (!stokvelName.trim()) { toast.error('Stokvel name required.'); return }
    if (!stokvel) { toast.error('No stokvel found.'); return }
    setSavingStokvel(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('stokvels')
        .update({
          name:             stokvelName.trim(),
          type:             stokvelType,
          province:         province || null,
          description:      description.trim() || null,
          monthly_amount:   Number(monthlyAmount) || stokvel.monthly_amount,
          payout_frequency: payoutFreq,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', stokvel.id)

      if (error) { toast.error(error.message); return }
      toast.success('Stokvel settings saved!')
    } catch {
      toast.error('Failed to save.')
    } finally {
      setSavingStokvel(false)
    }
  }

  async function saveProfile() {
    if (!fullName.trim()) { toast.error('Full name required.'); return }
    setSavingProfile(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name:  fullName.trim(),
          phone:      phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) { toast.error(error.message); return }
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (!newPw || newPw.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw)         { toast.error('Passwords do not match.'); return }

    setSavingPw(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) { toast.error(error.message); return }
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      toast.success('Password updated!')
    } catch {
      toast.error('Failed to update password.')
    } finally {
      setSavingPw(false)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== stokvel?.name && deleteConfirm !== 'DELETE') {
      toast.error(`Type "${stokvel?.name || 'DELETE'}" to confirm.`)
      return
    }
    setDeleting(true)
    toast.error('Account deletion requires contacting support. Email: support@stokvelos.co.za')
    setDeleting(false)
  }

  const navItems: { key: SectionKey; label: string; icon: string }[] = [
    { key: 'stokvel',      label: 'Stokvel Settings', icon: '🏦' },
    { key: 'profile',      label: 'Your Profile',     icon: '👤' },
    { key: 'subscription', label: 'Subscription',     icon: '💳' },
    { key: 'danger',       label: 'Danger Zone',      icon: '⚠️' },
  ]

  const planId = String(subscription?.plan_id || 'free')
  const planStatus = String(subscription?.status || 'free')

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="page-body">
        <div className="grid md:grid-cols-[200px_1fr] gap-6">

          {/* Nav sidebar */}
          <div className="space-y-1">
            {navItems.map(n => (
              <button
                key={n.key}
                onClick={() => setActive(n.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                style={{
                  background:  active === n.key ? 'rgba(15,61,30,0.08)' : 'transparent',
                  color:       active === n.key ? '#0a2412' : '#6b7280',
                  fontWeight:  active === n.key ? 600 : 400,
                  borderLeft:  active === n.key ? '3px solid #ca8a04' : '3px solid transparent',
                }}
              >
                <span>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div>

            {/* ── STOKVEL SETTINGS ─────────────────────── */}
            {active === 'stokvel' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Stokvel Settings</span>
                </div>
                <div className="card-body space-y-4">
                  {!stokvel ? (
                    <p className="text-sm" style={{ color: '#6b7280' }}>
                      No stokvel found.{' '}
                      <Link href="/setup" style={{ color: '#ca8a04' }}>Set one up →</Link>
                    </p>
                  ) : (
                    <>
                      <div className="form-group mb-0">
                        <label className="form-label">Stokvel name *</label>
                        <input className="form-input" value={stokvelName} onChange={e => setStokvelName(e.target.value)} />
                      </div>

                      <div className="form-group mb-0">
                        <label className="form-label">Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {STOKVEL_TYPES.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setStokvelType(t)}
                              className="rounded-xl border py-2.5 text-center transition-all duration-150 flex items-center justify-center gap-1.5"
                              style={{
                                borderColor: stokvelType === t ? '#ca8a04' : 'rgba(15,61,30,0.15)',
                                background:  stokvelType === t ? 'rgba(202,138,4,0.06)' : 'white',
                              }}
                            >
                              <span>{STOKVEL_TYPE_ICONS[t]}</span>
                              <span className="text-xs font-mono" style={{ color: stokvelType === t ? '#0a2412' : '#6b7280' }}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group mb-0">
                          <label className="form-label">Province</label>
                          <select className="form-select" value={province} onChange={e => setProvince(e.target.value)}>
                            <option value="">Select…</option>
                            {SA_PROVINCES.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="form-group mb-0">
                          <label className="form-label">Monthly contribution (R)</label>
                          <input className="form-input" type="number" min="1" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} />
                        </div>
                      </div>

                      <div className="form-group mb-0">
                        <label className="form-label">Payout frequency</label>
                        <div className="flex gap-2">
                          {PAYOUT_FREQS.map(f => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setPayoutFreq(f)}
                              className="flex-1 rounded-xl border py-2.5 text-sm font-mono transition-all"
                              style={{
                                borderColor: payoutFreq === f ? '#ca8a04' : 'rgba(15,61,30,0.15)',
                                background:  payoutFreq === f ? 'rgba(202,138,4,0.06)' : 'white',
                                color:       payoutFreq === f ? '#0a2412' : '#9ca3af',
                              }}
                            >
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-group mb-0">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          style={{ minHeight: '64px' }}
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button variant="primary" size="md" onClick={saveStokvel} loading={savingStokvel}>
                          Save Settings
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── PROFILE ──────────────────────────────── */}
            {active === 'profile' && (
              <div className="space-y-5">
                <div className="card">
                  <div className="card-header"><span className="card-title">Your Profile</span></div>
                  <div className="card-body space-y-4">
                    <div className="form-row">
                      <div className="form-group mb-0">
                        <label className="form-label">Full name *</label>
                        <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} />
                      </div>
                      <div className="form-group mb-0">
                        <label className="form-label">Phone number</label>
                        <input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">Email address</label>
                      <input
                        className="form-input"
                        value={userEmail}
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      />
                      <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Email cannot be changed here.</p>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="primary" size="md" onClick={saveProfile} loading={savingProfile}>
                        Save Profile
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><span className="card-title">Change Password</span></div>
                  <div className="card-body space-y-3">
                    <div className="form-group mb-0">
                      <label className="form-label">New password</label>
                      <input className="form-input" type="password" placeholder="At least 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">Confirm new password</label>
                      <input className="form-input" type="password" placeholder="Repeat password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button variant="outline" size="md" onClick={savePassword} loading={savingPw}>
                        Update Password
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="md" onClick={handleSignOut} style={{ color: '#dc2626' }}>
                    Sign Out
                  </Button>
                </div>
              </div>
            )}

            {/* ── SUBSCRIPTION ─────────────────────────── */}
            {active === 'subscription' && (
              <div className="space-y-5">
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Current Plan</span>
                    <Badge variant={planStatus === 'active' ? 'success' : 'neutral'}>
                      {planStatus === 'active' ? 'Active' : 'Free'}
                    </Badge>
                  </div>
                  <div className="card-body">
                    <div
                      className="rounded-2xl p-5"
                      style={{
                        background: 'linear-gradient(135deg, #0a2412, #0f3d1e)',
                        color:      '#fef9c3',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(254,249,195,0.5)' }}>
                            Current Plan
                          </p>
                          <p className="font-display text-2xl">
                            {planId === 'premium' ? 'Premium' : planId === 'basic' ? 'Basic' : 'Beta (Free)'}
                          </p>
                          {planId !== 'free' && (
                            <p className="font-mono text-sm mt-1" style={{ color: '#ca8a04' }}>
                              R{planId === 'premium' ? '499' : '199'}/month
                            </p>
                          )}
                        </div>
                        <div className="text-3xl">
                          {planId === 'premium' ? '⭐' : planId === 'basic' ? '✦' : '🌱'}
                        </div>
                      </div>

                      {subscription?.next_billing != null && (
                        <p className="font-mono text-xs mt-4" style={{ color: 'rgba(254,249,195,0.5)' }}>
                          Next billing: {formatDate(String(subscription.next_billing))}
                        </p>
                      )}
                    </div>

                    {planId === 'free' ? (
                      <div className="mt-4">
                        <p className="text-sm mb-3" style={{ color: '#6b7280' }}>
                          You&apos;re on the free beta plan. Upgrade to unlock advanced features.
                        </p>
                        <Link href="/pricing">
                          <Button variant="gold" size="md">
                            Upgrade Plan →
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-2">
                        <Link href="/pricing">
                          <Button variant="outline" size="sm">Change Plan</Button>
                        </Link>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>
                          To cancel, contact us at support@stokvelos.co.za or manage via PayFast.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan comparison */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Plan Features</span></div>
                  <div className="card-body">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {[
                        { plan: 'Beta', price: 'Free', features: ['All features', 'Unlimited members', 'AI included', 'Beta period only'] },
                        { plan: 'Basic', price: 'R199/mo', features: ['Up to 20 members', 'Contributions', 'Basic reports', 'Email support'] },
                        { plan: 'Premium', price: 'R499/mo', features: ['Unlimited members', 'Full AI', 'PDF reports', 'WhatsApp automation'] },
                      ].map(p => (
                        <div
                          key={p.plan}
                          className="rounded-xl border p-4"
                          style={{
                            borderColor: planId === p.plan.toLowerCase() ? '#ca8a04' : 'rgba(15,61,30,0.1)',
                            background:  planId === p.plan.toLowerCase() ? 'rgba(202,138,4,0.04)' : 'white',
                          }}
                        >
                          <div className="font-display text-base mb-0.5">{p.plan}</div>
                          <div className="font-mono text-xs mb-3" style={{ color: '#ca8a04' }}>{p.price}</div>
                          <ul className="space-y-1.5">
                            {p.features.map((f, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: '#6b7280' }}>
                                <span style={{ color: '#16a34a' }}>✓</span> {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── DANGER ZONE ──────────────────────────── */}
            {active === 'danger' && (
              <div className="card" style={{ borderColor: 'rgba(220,38,38,0.2)' }}>
                <div className="card-header">
                  <span className="card-title" style={{ color: '#dc2626' }}>⚠️ Danger Zone</span>
                </div>
                <div className="card-body space-y-6">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)' }}
                  >
                    <h3 className="font-display text-base mb-2" style={{ color: '#0a2412' }}>Delete Account</h3>
                    <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
                      This permanently deletes your stokvel, all member data, contribution history, and meeting records.
                      This action <strong>cannot be undone</strong>.
                    </p>
                    <div className="form-group mb-3">
                      <label className="form-label">
                        Type <strong>{stokvel?.name || 'DELETE'}</strong> to confirm
                      </label>
                      <input
                        className="form-input"
                        placeholder={stokvel?.name || 'DELETE'}
                        value={deleteConfirm}
                        onChange={e => setDeleteConfirm(e.target.value)}
                        style={{ borderColor: 'rgba(220,38,38,0.3)' }}
                      />
                    </div>
                    <Button
                      variant="danger"
                      size="md"
                      onClick={handleDeleteAccount}
                      loading={deleting}
                      disabled={deleteConfirm !== stokvel?.name && deleteConfirm !== 'DELETE'}
                    >
                      Delete Account Permanently
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
