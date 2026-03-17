// lib/notion/workspace.ts
// Auto-deploy a full Notion workspace when a stokvel subscribes
// Syncs every transaction to Notion in real time for full member transparency

import { Client } from '@notionhq/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getNotion() {
  return new Client({ auth: process.env.NOTION_API_KEY })
}

function getSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Deploy a full Notion workspace for a stokvel ────────────────
export async function deployNotionWorkspace(stokvelId: string, stokvelName: string): Promise<string> {
  const notion  = getNotion()
  const supabase = getSupabase()

  // 1. Create parent page in the shared integration workspace
  const parentPage = await notion.pages.create({
    parent: { type: 'page_id', page_id: process.env.NOTION_ROOT_PAGE_ID! },
    icon:   { type: 'emoji', emoji: '💰' },
    properties: {
      title: { title: [{ text: { content: `${stokvelName} — StokvelOS` } }] },
    },
  })

  const parentPageId = parentPage.id

  // 2. Deploy all databases in parallel
  const [membersDb, contributionsDb, loansDb, payoutsDb, reportsDb] = await Promise.all([
    createMembersDatabase(notion, parentPageId, stokvelName),
    createContributionsDatabase(notion, parentPageId, stokvelName),
    createLoansDatabase(notion, parentPageId, stokvelName),
    createPayoutsDatabase(notion, parentPageId, stokvelName),
    createReportsDatabase(notion, parentPageId, stokvelName),
  ])

  // 3. Store all IDs in Supabase
  await supabase.from('stokvels').update({
    notion_workspace_id:        parentPageId,
    notion_members_db_id:       membersDb.id,
    notion_contributions_db_id: contributionsDb.id,
    notion_loans_db_id:         loansDb.id,
    notion_payouts_db_id:       payoutsDb.id,
  }).eq('id', stokvelId)

  // 4. Return shareable link
  return `https://notion.so/${parentPageId.replace(/-/g, '')}`
}

// ── Sync a contribution to Notion ───────────────────────────────
export async function syncContributionToNotion(contribution: {
  stokvel_id: string
  member_id:  string
  amount:     number
  payment_date: string
  payment_method: string
  receipt_number: string
  status:     string
  notion_contributions_db_id: string
  member_notion_page_id?: string
}): Promise<string | null> {
  try {
    const notion = getNotion()
    const page = await notion.pages.create({
      parent: { database_id: contribution.notion_contributions_db_id },
      properties: {
        'Receipt':  { title: [{ text: { content: contribution.receipt_number } }] },
        'Amount':   { number: contribution.amount },
        'Date':     { date: { start: contribution.payment_date } },
        'Method':   { select: { name: contribution.payment_method } },
        'Status':   { select: { name: contribution.status } },
        ...(contribution.member_notion_page_id ? {
          'Member': { relation: [{ id: contribution.member_notion_page_id }] },
        } : {}),
      },
    })
    return page.id
  } catch (err) {
    console.error('[Notion] syncContribution failed:', err)
    return null
  }
}

// ── Sync a payout to Notion ──────────────────────────────────────
export async function syncPayoutToNotion(payout: {
  amount:       number
  payout_date:  string
  receipt_number: string
  notes?:       string
  notion_payouts_db_id: string
  member_notion_page_id?: string
}): Promise<string | null> {
  try {
    const notion = getNotion()
    const page = await notion.pages.create({
      parent: { database_id: payout.notion_payouts_db_id },
      properties: {
        'Receipt':  { title: [{ text: { content: payout.receipt_number } }] },
        'Amount':   { number: payout.amount },
        'Date':     { date: { start: payout.payout_date } },
        'Notes':    { rich_text: [{ text: { content: payout.notes || '' } }] },
        ...(payout.member_notion_page_id ? {
          'Member': { relation: [{ id: payout.member_notion_page_id }] },
        } : {}),
      },
    })
    return page.id
  } catch (err) {
    console.error('[Notion] syncPayout failed:', err)
    return null
  }
}

// ── Database factory functions ───────────────────────────────────

async function createMembersDatabase(notion: Client, parentPageId: string, stokvelName: string) {
  return notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    icon:   { type: 'emoji', emoji: '👥' },
    title:  [{ text: { content: `${stokvelName} — Members` } }],
    properties: {
      'Name':              { title: {} },
      'Phone':             { phone_number: {} },
      'Role':              { select: { options: [
        { name: 'member',      color: 'blue' },
        { name: 'chairperson', color: 'green' },
        { name: 'treasurer',   color: 'orange' },
        { name: 'secretary',   color: 'purple' },
      ]}},
      'Status':            { select: { options: [
        { name: 'active',    color: 'green' },
        { name: 'suspended', color: 'red' },
        { name: 'exited',    color: 'gray' },
      ]}},
      'Date Joined':       { date: {} },
      'Compliance Rate %': { number: { format: 'percent' } },
    },
  })
}

async function createContributionsDatabase(notion: Client, parentPageId: string, stokvelName: string) {
  return notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    icon:   { type: 'emoji', emoji: '💳' },
    title:  [{ text: { content: `${stokvelName} — Contributions` } }],
    properties: {
      'Receipt':  { title: {} },
      'Member':   { relation: { single_property: {}, database_id: '' } },
      'Amount':   { number: { format: 'number_with_commas' } },
      'Date':     { date: {} },
      'Method':   { select: { options: [
        { name: 'cash',     color: 'green' },
        { name: 'eft',      color: 'blue' },
        { name: 'payfast',  color: 'orange' },
        { name: 'momo',     color: 'yellow' },
        { name: 'vodapay',  color: 'red' },
      ]}},
      'Status':   { select: { options: [
        { name: 'verified', color: 'green' },
        { name: 'pending',  color: 'yellow' },
        { name: 'disputed', color: 'red' },
      ]}},
    },
  })
}

async function createLoansDatabase(notion: Client, parentPageId: string, stokvelName: string) {
  return notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    icon:   { type: 'emoji', emoji: '🏦' },
    title:  [{ text: { content: `${stokvelName} — Loans` } }],
    properties: {
      'Receipt':            { title: {} },
      'Member':             { relation: { single_property: {}, database_id: '' } },
      'Amount':             { number: { format: 'number_with_commas' } },
      'Total Repayable':    { number: { format: 'number_with_commas' } },
      'Balance Outstanding':{ number: { format: 'number_with_commas' } },
      'Status':             { select: { options: [
        { name: 'pending',   color: 'yellow' },
        { name: 'active',    color: 'blue' },
        { name: 'paid',      color: 'green' },
        { name: 'overdue',   color: 'orange' },
        { name: 'defaulted', color: 'red' },
      ]}},
      'Start Date': { date: {} },
      'End Date':   { date: {} },
    },
  })
}

async function createPayoutsDatabase(notion: Client, parentPageId: string, stokvelName: string) {
  return notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    icon:   { type: 'emoji', emoji: '💸' },
    title:  [{ text: { content: `${stokvelName} — Payouts` } }],
    properties: {
      'Receipt': { title: {} },
      'Member':  { relation: { single_property: {}, database_id: '' } },
      'Amount':  { number: { format: 'number_with_commas' } },
      'Date':    { date: {} },
      'Notes':   { rich_text: {} },
    },
  })
}

async function createReportsDatabase(notion: Client, parentPageId: string, stokvelName: string) {
  return notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    icon:   { type: 'emoji', emoji: '📊' },
    title:  [{ text: { content: `${stokvelName} — Monthly Reports` } }],
    properties: {
      'Month':               { title: {} },
      'Total Collected':     { number: { format: 'number_with_commas' } },
      'Total Paid Out':      { number: { format: 'number_with_commas' } },
      'Compliance Rate %':   { number: { format: 'percent' } },
      'Active Members':      { number: {} },
      'Fraud Alerts':        { number: {} },
      'AI Summary':          { rich_text: {} },
    },
  })
}
