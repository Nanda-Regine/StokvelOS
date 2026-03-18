// lib/notion/workspace.ts
// Auto-deploy a full Notion workspace when a stokvel subscribes.
// Sequential creation — Members DB is created first so others can reference it.
// Error-safe: partial failures are logged but don't break onboarding.

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
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_ROOT_PAGE_ID) {
    console.warn('[Notion] NOTION_API_KEY or NOTION_ROOT_PAGE_ID not set — skipping workspace deploy')
    return ''
  }

  const notion   = getNotion()
  const supabase = getSupabase()

  // 1. Create parent page
  const parentPage = await notion.pages.create({
    parent:     { type: 'page_id', page_id: process.env.NOTION_ROOT_PAGE_ID },
    icon:       { type: 'emoji', emoji: '💰' },
    properties: {
      title: { title: [{ text: { content: `${stokvelName} — StokvelOS` } }] },
    },
  })
  const parentPageId = parentPage.id

  // 2. Create Members DB first (others will reference it)
  const membersDb = await createMembersDatabase(notion, parentPageId, stokvelName)

  // 3. Create remaining databases with correct Members DB relation ID
  const [contributionsDb, loansDb, payoutsDb, reportsDb] = await Promise.all([
    createContributionsDatabase(notion, parentPageId, stokvelName, membersDb.id),
    createLoansDatabase(notion, parentPageId, stokvelName, membersDb.id),
    createPayoutsDatabase(notion, parentPageId, stokvelName, membersDb.id),
    createReportsDatabase(notion, parentPageId, stokvelName),
  ])

  // 4. Store all IDs in Supabase
  await supabase.from('stokvels').update({
    notion_workspace_id:        parentPageId,
    notion_members_db_id:       membersDb.id,
    notion_contributions_db_id: contributionsDb.id,
    notion_loans_db_id:         loansDb.id,
    notion_payouts_db_id:       payoutsDb.id,
  }).eq('id', stokvelId)

  return `https://notion.so/${parentPageId.replace(/-/g, '')}`
}

// ── Sync a contribution to Notion ───────────────────────────────
export async function syncContributionToNotion(params: {
  stokvelId:               string
  memberNotionPageId?:     string
  amount:                  number
  date:                    string
  method:                  string
  receiptNumber:           string
  status:                  string
  notionContributionsDbId: string
}): Promise<string | null> {
  if (!process.env.NOTION_API_KEY) return null
  try {
    const notion = getNotion()
    const page   = await notion.pages.create({
      parent:     { database_id: params.notionContributionsDbId },
      properties: {
        'Receipt': { title: [{ text: { content: params.receiptNumber } }] },
        'Amount':  { number: params.amount },
        'Date':    { date: { start: params.date } },
        'Method':  { select: { name: params.method } },
        'Status':  { select: { name: params.status } },
        ...(params.memberNotionPageId
          ? { 'Member': { relation: [{ id: params.memberNotionPageId }] } }
          : {}),
      },
    })
    return page.id
  } catch (err) {
    console.error('[Notion] syncContribution failed:', err)
    return null
  }
}

// ── Sync a payout to Notion ──────────────────────────────────────
export async function syncPayoutToNotion(params: {
  memberNotionPageId?: string
  amount:              number
  date:                string
  receiptNumber:       string
  notes?:              string
  notionPayoutsDbId:   string
}): Promise<string | null> {
  if (!process.env.NOTION_API_KEY) return null
  try {
    const notion = getNotion()
    const page   = await notion.pages.create({
      parent:     { database_id: params.notionPayoutsDbId },
      properties: {
        'Receipt': { title: [{ text: { content: params.receiptNumber } }] },
        'Amount':  { number: params.amount },
        'Date':    { date: { start: params.date } },
        'Notes':   { rich_text: [{ text: { content: params.notes ?? '' } }] },
        ...(params.memberNotionPageId
          ? { 'Member': { relation: [{ id: params.memberNotionPageId }] } }
          : {}),
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
    parent:     { type: 'page_id', page_id: parentPageId },
    icon:       { type: 'emoji', emoji: '👥' },
    title:      [{ text: { content: `${stokvelName} — Members` } }],
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
      'Compliance %':      { number: { format: 'percent' } },
      'Total Contributed': { number: { format: 'number_with_commas' } },
    },
  })
}

async function createContributionsDatabase(
  notion: Client,
  parentPageId: string,
  stokvelName: string,
  membersDatabaseId: string
) {
  return notion.databases.create({
    parent:     { type: 'page_id', page_id: parentPageId },
    icon:       { type: 'emoji', emoji: '💳' },
    title:      [{ text: { content: `${stokvelName} — Contributions` } }],
    properties: {
      'Receipt': { title: {} },
      'Member':  { relation: { single_property: {}, database_id: membersDatabaseId } },
      'Amount':  { number: { format: 'number_with_commas' } },
      'Date':    { date: {} },
      'Method':  { select: { options: [
        { name: 'cash',    color: 'green' },
        { name: 'eft',     color: 'blue' },
        { name: 'payfast', color: 'orange' },
        { name: 'momo',    color: 'yellow' },
        { name: 'vodapay', color: 'red' },
      ]}},
      'Status':  { select: { options: [
        { name: 'confirmed', color: 'green' },
        { name: 'verified',  color: 'green' },
        { name: 'pending',   color: 'yellow' },
        { name: 'rejected',  color: 'red' },
      ]}},
    },
  })
}

async function createLoansDatabase(
  notion: Client,
  parentPageId: string,
  stokvelName: string,
  membersDatabaseId: string
) {
  return notion.databases.create({
    parent:     { type: 'page_id', page_id: parentPageId },
    icon:       { type: 'emoji', emoji: '🏦' },
    title:      [{ text: { content: `${stokvelName} — Loans` } }],
    properties: {
      'Receipt':             { title: {} },
      'Member':              { relation: { single_property: {}, database_id: membersDatabaseId } },
      'Amount':              { number: { format: 'number_with_commas' } },
      'Total Repayable':     { number: { format: 'number_with_commas' } },
      'Balance Outstanding': { number: { format: 'number_with_commas' } },
      'Status':              { select: { options: [
        { name: 'pending',   color: 'yellow' },
        { name: 'active',    color: 'blue' },
        { name: 'paid',      color: 'green' },
        { name: 'overdue',   color: 'orange' },
        { name: 'defaulted', color: 'red' },
      ]}},
      'Start Date':          { date: {} },
      'End Date':            { date: {} },
    },
  })
}

async function createPayoutsDatabase(
  notion: Client,
  parentPageId: string,
  stokvelName: string,
  membersDatabaseId: string
) {
  return notion.databases.create({
    parent:     { type: 'page_id', page_id: parentPageId },
    icon:       { type: 'emoji', emoji: '💸' },
    title:      [{ text: { content: `${stokvelName} — Payouts` } }],
    properties: {
      'Receipt': { title: {} },
      'Member':  { relation: { single_property: {}, database_id: membersDatabaseId } },
      'Amount':  { number: { format: 'number_with_commas' } },
      'Date':    { date: {} },
      'Notes':   { rich_text: {} },
    },
  })
}

async function createReportsDatabase(notion: Client, parentPageId: string, stokvelName: string) {
  return notion.databases.create({
    parent:     { type: 'page_id', page_id: parentPageId },
    icon:       { type: 'emoji', emoji: '📊' },
    title:      [{ text: { content: `${stokvelName} — Monthly Reports` } }],
    properties: {
      'Month':             { title: {} },
      'Total Collected':   { number: { format: 'number_with_commas' } },
      'Total Paid Out':    { number: { format: 'number_with_commas' } },
      'Compliance %':      { number: { format: 'percent' } },
      'Active Members':    { number: {} },
      'Fraud Alerts':      { number: {} },
      'AI Summary':        { rich_text: {} },
    },
  })
}
