/// <reference lib="deno.ns" />

import { Webhook } from 'npm:svix@1.39.0'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const SEND_EMAIL_HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL')
const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'NuRSYNC Student Registry'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!BREVO_API_KEY || !SEND_EMAIL_HOOK_SECRET || !SENDER_EMAIL) {
    console.error('Missing required email function secrets')
    return new Response(JSON.stringify({ error: 'Email service is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers.entries())

    // Supabase provides the hook secret as `v1,whsec_...`.
    // Svix expects the secret value without the `v1,whsec_` prefix.
    const hookSecret = SEND_EMAIL_HOOK_SECRET.replace(/^v1,whsec_/, '')
    const webhook = new Webhook(hookSecret)

    const data = webhook.verify(payload, headers) as {
      user?: {
        id?: string
        email?: string
      }
      email_data?: {
        token?: string
        email_action_type?: string
      }
    }

    const recipientEmail = data.user?.email
    const otp = data.email_data?.token

    if (!recipientEmail || !otp) {
      console.error('Invalid Send Email Hook payload')
      return new Response(JSON.stringify({ error: 'Invalid email hook payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Sending ${data.email_data?.email_action_type || 'auth'} email to ${recipientEmail}`)

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:40px 20px;background:#f7f5ef;font-family:Arial,sans-serif;color:#29261f;">
          <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <h2 style="margin-top:0;color:#29261f;">NuRSYNC Student Registry</h2>
            <p>You requested to reset your administrator password.</p>
            <p>Your verification code is:</p>
            <div style="margin:24px 0;padding:18px;background:#f1efe8;border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;">
              ${otp}
            </div>
            <p>Enter this 6-digit code in the NuRSYNC Student Registry system to continue.</p>
            <p style="color:#777;font-size:13px;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `

    const textContent = `NuRSYNC Student Registry

You requested to reset your administrator password.

Your verification code is:

${otp}

Enter this 6-digit code in the NuRSYNC Student Registry system to continue.

If you did not request a password reset, you can safely ignore this email.`

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [{ email: recipientEmail }],
        subject: 'NuRSYNC Admin Verification Code',
        htmlContent,
        textContent,
      }),
    })

    const brevoBody = await brevoResponse.text()

    if (!brevoResponse.ok) {
      console.error('Brevo error:', brevoResponse.status, brevoBody)
      return new Response(JSON.stringify({ error: 'Brevo failed to send the email' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('Brevo email sent successfully:', brevoBody)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Send Email Hook error:', error)

    return new Response(JSON.stringify({ error: 'Failed to process email hook' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
