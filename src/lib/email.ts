import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { devMailStore } from './dev-mail';
import { renderEmailTemplate, formatEmailDate, formatEmailPrice } from './email-templates';
import prisma from './prisma';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Get SMTP settings from database
async function getSmtpSettings() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL", "SMTP_FROM_NAME", "SMTP_ENABLED"],
      },
    },
  });

  const enabled = settings.find((s) => s.key === "SMTP_ENABLED")?.value === "true";

  // Return null if SMTP is disabled
  if (!enabled) {
    return null;
  }

  const config = {
    host: settings.find((s) => s.key === "SMTP_HOST")?.value,
    port: settings.find((s) => s.key === "SMTP_PORT")?.value,
    user: settings.find((s) => s.key === "SMTP_USER")?.value,
    password: settings.find((s) => s.key === "SMTP_PASSWORD")?.value,
    fromEmail: settings.find((s) => s.key === "SMTP_FROM_EMAIL")?.value,
    fromName: settings.find((s) => s.key === "SMTP_FROM_NAME")?.value || "Familie Waubke",
  };

  // Check if SMTP is configured
  if (config.host && config.port && config.user && config.password) {
    return config;
  }

  return null;
}

// Create SMTP transporter
async function createSmtpTransporter() {
  const smtpSettings = await getSmtpSettings();
  
  if (!smtpSettings) {
    return null;
  }

  return nodemailer.createTransporter({
    host: smtpSettings.host,
    port: parseInt(smtpSettings.port || "587"),
    secure: parseInt(smtpSettings.port || "587") === 465,
    auth: {
      user: smtpSettings.user,
      pass: smtpSettings.password,
    },
  });
}

// Send email using configured method (SMTP, Resend, or Dev)
async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  headers,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}) {
  try {
    // 1. Try SMTP if configured
    const smtpTransporter = await createSmtpTransporter();
    if (smtpTransporter) {
      const smtpSettings = await getSmtpSettings();
      await smtpTransporter.sendMail({
        from: `"${smtpSettings?.fromName}" <${smtpSettings?.fromEmail || smtpSettings?.user}>`,
        to,
        subject,
        html,
        text,
        replyTo,
        headers,
      });
      console.log(`Email sent via SMTP to ${to}: "${subject}"`);
      return { success: true };
    }

    // 2. Try Resend if configured
    if (resend) {
      await resend.emails.send({
        from: `"Familie Waubke" <onboarding@resend.dev>`,
        to,
        subject,
        html,
        text,
        reply_to: replyTo,
        headers,
      });
      console.log(`Email sent via Resend to ${to}: "${subject}"`);
      return { success: true };
    }

    // 3. Fallback to dev mode
    devMailStore.addEmail({
      to,
      subject,
      html,
      text,
      replyTo,
      headers,
      sentAt: new Date(),
    });
    console.log(`Dev email stored for ${to}: "${subject}"`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return { success: false, error };
  }
}

// Generic email sender using templates
async function sendTemplatedEmail(
  templateKey: string,
  to: string,
  variables: Record<string, any>,
  replyTo?: string,
  customHeaders?: Record<string, string>
) {
  try {
    const rendered = await renderEmailTemplate(templateKey, variables);
    
    if (!rendered) {
      console.error(`Failed to render template: ${templateKey}`);
      return { success: false, error: 'Template not found or inactive' };
    }

    return await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo,
      headers: customHeaders,
    });
  } catch (error: any) {
    console.error(`Error sending email (${templateKey}):`, error);
    return { success: false, error: error.message };
  }
}

// Magic Link Email (Admin Login)
export async function sendMagicLinkEmail({
  to,
  token,
  name,
}: {
  to: string;
  token: string;
  name?: string;
}) {
  const loginUrl = `${appUrl}/auth/verify?token=${token}`;
  
  return sendTemplatedEmail('magic_link', to, {
    adminName: name || to.split('@')[0],
    loginUrl,
    expiryMinutes: '15',
  });
}

// Booking Confirmation (to Guest)
export async function sendBookingConfirmationToGuest({
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  numberOfGuests,
  totalPrice,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  numberOfGuests: number;
  totalPrice: number;
}) {
  const statusUrl = `${appUrl}/booking/status?email=${encodeURIComponent(guestEmail)}&code=${bookingCode}`;
  
  return sendTemplatedEmail('booking_confirmation', guestEmail, {
    guestName: guestName || guestEmail.split('@')[0],
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    numberOfGuests: numberOfGuests.toString(),
    totalPrice: formatEmailPrice(totalPrice),
    statusUrl,
  }, undefined, {
    'X-Booking-Code': bookingCode,
  });
}

// Booking Approved
export async function sendBookingApprovalToGuest({
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  numberOfGuests,
  totalPrice,
  adminNotes,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  numberOfGuests: number;
  totalPrice: number;
  adminNotes?: string;
}) {
  return sendTemplatedEmail('booking_approved', guestEmail, {
    guestName: guestName || guestEmail.split('@')[0],
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    numberOfGuests: numberOfGuests.toString(),
    totalPrice: formatEmailPrice(totalPrice),
    adminNotes: adminNotes || '',
  }, undefined, {
    'X-Booking-Code': bookingCode,
  });
}

// Booking Rejected
export async function sendBookingRejectionToGuest({
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  rejectionReason,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  rejectionReason?: string;
}) {
  return sendTemplatedEmail('booking_rejected', guestEmail, {
    guestName: guestName || guestEmail.split('@')[0],
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    rejectionReason: rejectionReason || '',
  }, undefined, {
    'X-Booking-Code': bookingCode,
  });
}

// New Message Notification
export async function sendMessageNotificationToGuest({
  guestEmail,
  guestName,
  bookingCode,
  messageContent,
  senderName,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  messageContent: string;
  senderName: string;
}) {
  const replyUrl = `${appUrl}/booking/status?email=${encodeURIComponent(guestEmail)}&code=${bookingCode}`;
  const smtpSettings = await getSmtpSettings();
  const replyToEmail = process.env.ADMIN_REPLY_EMAIL || smtpSettings?.fromEmail || smtpSettings?.user || "noreply@domburg.local";
  
  return sendTemplatedEmail(
    'new_message',
    guestEmail,
    {
      guestName: guestName || guestEmail.split('@')[0],
      bookingCode,
      messageContent,
      senderName,
      replyUrl,
    },
    replyToEmail,
    {
      'X-Booking-Code': bookingCode,
    }
  );
}

// New Booking Notification (to Admin)
export async function sendBookingNotificationToAdmin({
  adminEmail,
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  numberOfGuests,
  totalPrice,
  message,
}: {
  adminEmail: string;
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  numberOfGuests: number;
  totalPrice: number;
  message?: string;
}) {
  const adminUrl = `${appUrl}/admin/bookings`;
  
  return sendTemplatedEmail('admin_new_booking', adminEmail, {
    guestName: guestName || guestEmail.split('@')[0],
    guestEmail,
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    numberOfGuests: numberOfGuests.toString(),
    totalPrice: formatEmailPrice(totalPrice),
    message: message || '',
    adminUrl,
  });
}

// Send to all admins
export async function notifyAllAdmins(
  templateKey: string,
  variables: Record<string, any>
) {
  try {
    const prisma = (await import('./prisma')).default;
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });

    const results = await Promise.all(
      admins.map((admin) =>
        sendTemplatedEmail(templateKey, admin.email, variables)
      )
    );

    return {
      success: true,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  } catch (error: any) {
    console.error('Error notifying admins:', error);
    return { success: false, error: error.message };
  }
}

