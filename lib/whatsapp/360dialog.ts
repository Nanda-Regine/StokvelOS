// lib/whatsapp/360dialog.ts
// 360dialog WhatsApp Business API client
// Africa-optimised — best latency for SA/ZA numbers

const API_BASE = 'https://waba.360dialog.io/v1'

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'D360-API-KEY': process.env.DIALOG360_API_KEY!,
  }
}

export async function sendWhatsAppText(to: string, message: string): Promise<string | null> {
  const phone = normalisePhone(to)
  const body = {
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { body: message },
  }

  const res = await fetch(`${API_BASE}/messages`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[360dialog] send failed:', err)
    return null
  }

  const data = await res.json()
  return data.messages?.[0]?.id ?? null
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: object[]
): Promise<string | null> {
  const phone = normalisePhone(to)
  const body = {
    to: phone,
    type: 'template',
    template: {
      namespace: process.env.DIALOG360_NAMESPACE,
      name:      templateName,
      language:  { code: languageCode, policy: 'deterministic' },
      components,
    },
  }

  const res = await fetch(`${API_BASE}/messages`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[360dialog] template send failed:', err)
    return null
  }

  const data = await res.json()
  return data.messages?.[0]?.id ?? null
}

// Normalise SA numbers: 0821234567 → 27821234567
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('27')) return digits
  if (digits.startsWith('0')) return `27${digits.slice(1)}`
  return digits
}

// Verify 360dialog webhook signature
export function verifyWebhook(request: Request, rawBody: string): boolean {
  const apiKey = request.headers.get('D360-API-KEY') || request.headers.get('d360-api-key')
  return apiKey === process.env.DIALOG360_WEBHOOK_SECRET
}
