import nodemailer from 'nodemailer';
import { supabase } from './supabase.ts';

// Configure email transporter with SMTP environment variables or fallback test account
let transporter: nodemailer.Transporter | null = null;

function getEmailTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;

  if (smtpHost && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  } else if (smtpUser && smtpPass && smtpUser.includes('@gmail.com')) {
    // Direct Gmail SMTP
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  } else {
    // Default fallback transporter (can log or send via test ethereal account)
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    });
  }

  return transporter;
}

export async function sendPasswordResetEmail(email: string, code: string, userName?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = userName || 'Student';

  // 1. Try Supabase Auth password reset trigger if available
  if (supabase) {
    try {
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${process.env.APP_URL || 'https://123studysync.vercel.app'}/reset-password`
      });
    } catch (supaErr) {
      console.warn('[Email] Supabase auth reset trigger notice:', supaErr);
    }
  }

  // 2. Send custom HTML verification code email via SMTP
  try {
    const mailer = getEmailTransporter();
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || '"StudySync Security" <security@studysync.app>';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #ffffff; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 20px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; }
        .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 12px; rounded: 9999px; margin-top: 6px; }
        .code-box { background: #000000; border: 1px solid #3f3f46; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
        .code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff; }
        .expire { font-size: 12px; color: #a1a1aa; margin-top: 8px; }
        .text { font-size: 14px; line-height: 1.6; color: #d4d4d8; }
        .footer { margin-top: 32px; border-top: 1px solid #27272a; padding-top: 16px; font-size: 11px; color: #71717a; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">StudySync</div>
          <div class="badge">Password Reset Request</div>
        </div>
        <p class="text">Hello <strong>${displayName}</strong>,</p>
        <p class="text">We received a request to reset your StudySync account password. Use the 6-digit verification code below to complete the reset:</p>
        
        <div class="code-box">
          <div class="code">${code}</div>
          <div class="expire">This code expires in 15 minutes.</div>
        </div>

        <p class="text" style="font-size: 12px; color: #a1a1aa;">
          If you did not request this password reset, please ignore this email or change your account password if you suspect unauthorized activity.
        </p>

        <div class="footer">
          &copy; ${new Date().getFullYear()} StudySync. Real-Time Peer Accountability & AI Focus.
        </div>
      </div>
    </body>
    </html>
    `;

    const info = await mailer.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: `Your StudySync Verification Code: ${code}`,
      text: `Hello ${displayName},\n\nYour 6-digit StudySync password reset verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: htmlContent
    });

    console.log(`[Email] Password reset OTP sent to ${cleanEmail} (Message ID: ${info?.messageId})`);
    return { success: true, messageId: info?.messageId };
  } catch (err: any) {
    console.error(`[Email] Failed to deliver password reset email to ${cleanEmail}:`, err?.message || err);
    return { success: false, error: err?.message || 'Failed to dispatch email' };
  }
}
