import nodemailer from 'nodemailer';
import { supabase } from './supabase.ts';

// ── Email Dispatch Service (Resend HTTP REST API + SMTP + Supabase Auth) ──

export async function sendPasswordResetEmail(
  email: string, 
  code: string, 
  userName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = userName || 'Student';

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StudySync Verification Code</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #ffffff; margin: 0; padding: 24px; }
      .container { max-width: 520px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
      .header { text-align: center; margin-bottom: 28px; }
      .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; margin-bottom: 6px; }
      .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 9999px; }
      .code-box { background: #000000; border: 1px solid #3f3f46; border-radius: 18px; padding: 24px; text-align: center; margin: 26px 0; }
      .code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #ffffff; }
      .expire { font-size: 12px; color: #a1a1aa; margin-top: 10px; font-weight: 500; }
      .text { font-size: 14px; line-height: 1.6; color: #d4d4d8; margin: 12px 0; }
      .footer { margin-top: 36px; border-top: 1px solid #27272a; padding-top: 20px; font-size: 11px; color: #71717a; text-align: center; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">StudySync</div>
        <div class="badge">Password Reset Request</div>
      </div>
      <p class="text">Hello <strong>${displayName}</strong>,</p>
      <p class="text">We received a request to reset the password for your StudySync account. Use the 6-digit verification code below to proceed:</p>
      
      <div class="code-box">
        <div class="code">${code}</div>
        <div class="expire">⏱️ Valid for 15 minutes</div>
      </div>

      <p class="text" style="font-size: 12px; color: #a1a1aa;">
        If you did not request this verification code, you can safely disregard this email. Your password will remain unchanged.
      </p>

      <div class="footer">
        &copy; ${new Date().getFullYear()} StudySync. Real-Time Peer Accountability & AI Focus.
      </div>
    </div>
  </body>
  </html>
  `;

  // 0. EmailJS REST API Provider (Connects directly with Gmail/Outlook without custom domain)
  const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
  const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
  const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID;
  const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (emailjsServiceId && emailjsTemplateId && (emailjsPublicKey || emailjsPrivateKey)) {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: emailjsServiceId,
          template_id: emailjsTemplateId,
          user_id: emailjsPublicKey,
          ...(emailjsPrivateKey && { accessToken: emailjsPrivateKey }),
          template_params: {
            to_email: cleanEmail,
            email: cleanEmail,
            to_name: displayName,
            name: displayName,
            otp_code: code,
            code: code,
            passcode: code
          }
        })
      });

      if (res.ok) {
        console.log(`[Email] EmailJS dispatched OTP to ${cleanEmail}`);
        return { success: true };
      } else {
        const errText = await res.text().catch(() => '');
        console.warn('[Email] EmailJS API error response:', errText);
      }
    } catch (ejsErr) {
      console.warn('[Email] EmailJS API exception:', ejsErr);
    }
  }

  // 1. First priority: Resend HTTP REST API (100% reliable on Vercel Serverless)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'StudySync Security <onboarding@resend.dev>',
          to: [cleanEmail],
          subject: `Your StudySync Verification Code: ${code}`,
          html: htmlContent
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.id) {
        console.log(`[Email] Resend dispatched OTP to ${cleanEmail} (ID: ${data.id})`);
        return { success: true, messageId: data.id };
      } else {
        console.warn('[Email] Resend API error response:', data);
      }
    } catch (rErr) {
      console.warn('[Email] Resend API exception:', rErr);
    }
  }

  // 2. Second priority: SendGrid HTTP API
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sendgridApiKey}`
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: cleanEmail }] }],
          from: { email: process.env.EMAIL_FROM || 'security@studysync.app', name: 'StudySync Security' },
          subject: `Your StudySync Verification Code: ${code}`,
          content: [{ type: 'text/html', value: htmlContent }]
        })
      });

      if (res.ok) {
        console.log(`[Email] SendGrid dispatched OTP to ${cleanEmail}`);
        return { success: true };
      }
    } catch (sgErr) {
      console.warn('[Email] SendGrid API exception:', sgErr);
    }
  }

  // 3. Third priority: Standard SMTP / Gmail App Password
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);

  if ((smtpHost && smtpUser && smtpPass) || (smtpUser && smtpPass && smtpUser.includes('@gmail.com'))) {
    try {
      const transporter = smtpUser.includes('@gmail.com') && !smtpHost
        ? nodemailer.createTransport({
            service: 'gmail',
            auth: { user: smtpUser, pass: smtpPass }
          })
        : nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass }
          });

      const fromAddress = process.env.EMAIL_FROM || smtpUser;
      const info = await transporter.sendMail({
        from: fromAddress.includes('<') ? fromAddress : `"StudySync Security" <${fromAddress}>`,
        to: cleanEmail,
        subject: `Your StudySync Verification Code: ${code}`,
        text: `Hello ${displayName},\n\nYour 6-digit StudySync password reset code is: ${code}\n\nThis code expires in 15 minutes.`,
        html: htmlContent
      });

      console.log(`[Email] SMTP dispatched OTP to ${cleanEmail} (ID: ${info?.messageId})`);
      return { success: true, messageId: info?.messageId };
    } catch (smtpErr: any) {
      console.error(`[Email] SMTP delivery failed to ${cleanEmail}:`, smtpErr?.message || smtpErr);
    }
  }

  // 4. Fourth priority: Supabase Auth Email
  if (supabase) {
    try {
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${process.env.APP_URL || 'https://123studysync.vercel.app'}/reset-password`
      });
      console.log(`[Email] Supabase auth reset triggered for ${cleanEmail}`);
    } catch (supaErr) {
      console.warn('[Email] Supabase auth reset exception:', supaErr);
    }
  }

  console.warn(`[Email Notice] No active mail provider configured (RESEND_API_KEY or SMTP_USER/SMTP_PASS).`);
  return { 
    success: false, 
    error: 'Email service credentials not configured. Please add RESEND_API_KEY or Gmail SMTP in your environment.' 
  };
}
