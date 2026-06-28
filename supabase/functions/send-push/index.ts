import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// --- Minimal Web Push implementation (no external npm needed) ---
async function buildPushRequest(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) {
  const { endpoint, keys } = subscription

  // Import VAPID private key
  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const origin = new URL(endpoint).origin
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600

  const vapidHeader = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const vapidPayload = btoa(JSON.stringify({ aud: origin, exp: expiration, sub: 'mailto:aquasense@psr.local' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const sigInput = new TextEncoder().encode(`${vapidHeader}.${vapidPayload}`)
  const sigBytes = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, sigInput)
  const sig = base64Url(sigBytes)
  const jwt = `${vapidHeader}.${vapidPayload}.${sig}`

  const vapidAuth = `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`

  // Encrypt payload
  const encrypted = await encryptPayload(payload, keys.p256dh, keys.auth)

  return new Request(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': vapidAuth,
      'TTL': '86400',
    },
    body: encrypted,
  })
}

async function encryptPayload(payload: string, p256dhBase64: string, authBase64: string) {
  const p256dh = base64UrlDecode(p256dhBase64)
  const auth = base64UrlDecode(authBase64)

  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256)

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // PRK
  const authKey = await crypto.subtle.importKey('raw', auth, { name: 'HKDF' }, false, ['deriveBits'])
  const prkBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(sharedSecret), info: concat(new TextEncoder().encode('WebPush: info\x00'), new Uint8Array(p256dh), new Uint8Array(serverPublicKeyRaw)) },
    authKey, 256,
  )

  // CEK & nonce
  const prkKey = await crypto.subtle.importKey('raw', prkBits, { name: 'HKDF' }, false, ['deriveBits'])
  const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: aes128gcm\x00') }, prkKey, 128)
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: nonce\x00') }, prkKey, 96)

  const cek = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt'])
  const plaintext = concat(new TextEncoder().encode(payload), new Uint8Array([2]))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBits }, cek, plaintext)

  // Build aes128gcm content
  const rs = 4096
  const header = new Uint8Array(21 + serverPublicKeyRaw.byteLength)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, rs, false)
  header[20] = serverPublicKeyRaw.byteLength
  header.set(new Uint8Array(serverPublicKeyRaw), 21)

  return concat(header, new Uint8Array(ciphertext))
}

function concat(...arrays: Uint8Array[]) {
  const total = arrays.reduce((n, a) => n + a.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.byteLength }
  return out
}

function base64Url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode(s: string) {
  const padded = s + '='.repeat((4 - s.length % 4) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// ===== Main handler =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { title, body, status } = await req.json()

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: subs, error } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth')
    if (error) throw error

    const results = await Promise.allSettled(
      (subs ?? []).map(async (sub) => {
        const req = await buildPushRequest(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, status }),
        )
        const res = await fetch(req)
        if (!res.ok && res.status !== 201) {
          // Remove invalid subscription
          if (res.status === 404 || res.status === 410) {
            await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      }),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent, total: subs?.length ?? 0 }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
