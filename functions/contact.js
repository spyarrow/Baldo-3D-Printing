/* ═══════════════════════════════════════════════════
   Cloudflare Pages Function — /contact
   Receives JSON from both contact forms and
   routes through Resend to your inbox.

   Environment variable (set in CF dashboard):
     RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxx
═══════════════════════════════════════════════════ */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const { name, email, message, formType } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing required fields.' }),
      { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid email address.' }),
      { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const isQuickContact = formType === 'quick';
  const subjectLine = isQuickContact
    ? `💬 Quick Message From ${name} — 3D Printing Service`
    : `🖨️ New Print Order Inquiry From ${name} — 3D Printing Service`;

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        body        { font-family: Inter, Arial, sans-serif; background: #0c1520; color: #d8e8f2; margin: 0; padding: 0; }
        .wrap       { max-width: 580px; margin: 0 auto; padding: 32px 24px; }
        .header     { background: #1e2d3d; border-bottom: 3px solid #f2c100; padding: 24px 28px; border-radius: 10px 10px 0 0; }
        .header h1  { font-size: 1.1rem; font-weight: 800; color: #f2c100; margin: 0; letter-spacing: -.01em; }
        .header p   { font-size: .78rem; color: #8aa4bc; margin: 5px 0 0; }
        .body       { background: #162333; padding: 28px; border-radius: 0 0 10px 10px; border: 1px solid rgba(255,255,255,.07); border-top: none; }
        .field      { margin-bottom: 20px; }
        .label      { font-size: .65rem; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #f2c100; margin-bottom: 5px; }
        .value      { font-size: .9rem; color: #d8e8f2; background: #0c1520; border: 1px solid rgba(255,255,255,.07); border-radius: 6px; padding: 10px 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
        .footer-note { margin-top: 22px; font-size: .72rem; color: #506a82; text-align: center; }
        .footer-note a { color: #f2c100; text-decoration: none; }
        .badge      { display: inline-block; background: rgba(242,193,0,.12); color: #f2c100; border: 1px solid rgba(242,193,0,.26); font-size: .62rem; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; padding: 3px 10px; border-radius: 4px; margin-bottom: 18px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <h1>3D Printing Service</h1>
          <p>${isQuickContact ? 'Quick Contact Form Submission' : 'Project Specs Intake Form Submission'}</p>
        </div>
        <div class="body">
          <div class="badge">${isQuickContact ? 'Quick Message' : 'Print Order Inquiry'}</div>

          <div class="field">
            <div class="label">Sender Name</div>
            <div class="value">${escapeHtml(name)}</div>
          </div>

          <div class="field">
            <div class="label">Reply-To Email</div>
            <div class="value">
              <a href="mailto:${escapeHtml(email)}" style="color:#f2c100;">${escapeHtml(email)}</a>
            </div>
          </div>

          ${body.stream ? `
          <div class="field">
            <div class="label">Print Stream</div>
            <div class="value">${escapeHtml(body.stream)}</div>
          </div>` : ''}

          ${body.material ? `
          <div class="field">
            <div class="label">Preferred Material</div>
            <div class="value">${escapeHtml(body.material)}</div>
          </div>` : ''}

          ${body.qty ? `
          <div class="field">
            <div class="label">Quantity</div>
            <div class="value">${escapeHtml(String(body.qty))}</div>
          </div>` : ''}

          ${body.colour ? `
          <div class="field">
            <div class="label">Colour / Finish</div>
            <div class="value">${escapeHtml(body.colour)}</div>
          </div>` : ''}

          ${body.deadline ? `
          <div class="field">
            <div class="label">Deadline</div>
            <div class="value">${escapeHtml(body.deadline)}</div>
          </div>` : ''}

          <div class="field">
            <div class="label">Message / Brief</div>
            <div class="value">${escapeHtml(message)}</div>
          </div>

          <div class="footer-note">
            Submitted via <a href="https://3dprintingservice.qa">3dprintingservice.qa</a>
            &nbsp;·&nbsp; Reply directly to
            <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
          </div>
        </div>
      </div>
    </body>
    </html>`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     'onboarding@resend.dev',   // ← swap to your verified domain later
        to:       ['spyarrow39@gmail.com'],
        reply_to: email,
        subject:  subjectLine,
        html:     emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error:', errText);
      return new Response(
        JSON.stringify({ ok: false, error: 'Email delivery failed. Please try again.' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    console.error('Fetch error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Server error. Please try again later.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}