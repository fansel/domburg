import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { devMailStore } from './dev-mail';
import { renderEmailTemplate, formatEmailDate, formatEmailPrice } from './email-templates';
import prisma from './prisma';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Get public URL from database settings or fallback to env var
export async function getPublicUrl(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'PUBLIC_URL' },
    });
    return setting?.value || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  } catch (error) {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
}

// Get Reply-To email from database settings or fallback
export async function getReplyToEmail(): Promise<string | undefined> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'REPLY_TO_EMAIL' },
    });
    if (setting?.value) {
      return setting.value;
    }
    // Fallback zu SMTP From Email oder env var
    const smtpSettings = await getSmtpSettings();
    return process.env.ADMIN_REPLY_EMAIL || smtpSettings?.fromEmail || smtpSettings?.user;
  } catch (error) {
    return process.env.ADMIN_REPLY_EMAIL;
  }
}

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

  return nodemailer.createTransport({
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
export async function sendEmail({
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
  let sentVia: string | undefined;
  
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
      sentVia = 'SMTP';
      return { success: true, sentVia };
    }

    // 2. Try Resend if configured
    if (resend) {
      await resend.emails.send({
        from: `"Familie Waubke" <onboarding@resend.dev>`,
        to,
        subject,
        html,
        text,
        ...(replyTo && { reply_to: replyTo }),
        ...(headers && { headers }),
      });
      console.log(`Email sent via Resend to ${to}: "${subject}"`);
      sentVia = 'Resend';
      return { success: true, sentVia };
    }

    // 3. Fallback to dev mode (nur wenn kein SMTP konfiguriert)
    const smtpConfigured = await getSmtpSettings();
    if (!smtpConfigured) {
    devMailStore.add({
      to,
      subject,
      html,
      text,
    });
    console.log(`Dev email stored for ${to}: "${subject}"`);
      sentVia = 'Dev';
      return { success: true, sentVia };
    }

    // Wenn SMTP konfiguriert ist aber nicht funktioniert hat, Fehler zurückgeben
    throw new Error("SMTP konfiguriert, aber E-Mail konnte nicht versendet werden");
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return { success: false, error, sentVia };
  }
}

// Log email to database
async function logEmail({
  templateKey,
  emailType,
  to,
  from,
  fromName,
  replyTo,
  subject,
  bodyHtml,
  bodyText,
  status,
  error,
  sentVia,
  metadata,
}: {
  templateKey?: string;
  emailType: string;
  to: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
  sentVia?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await (prisma as any).emailLog.create({
      data: {
        templateKey,
        emailType,
        to,
        from,
        fromName,
        replyTo,
        subject,
        bodyHtml,
        bodyText,
        status,
        error,
        sentVia,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log email:', error);
    // Log-Fehler sollen E-Mail-Versand nicht verhindern
  }
}

// Generic email sender using templates
export async function sendTemplatedEmail(
  templateKey: string,
  to: string,
  variables: Record<string, any>,
  replyTo?: string,
  customHeaders?: Record<string, string>,
  emailType?: string
) {
  try {
    const rendered = await renderEmailTemplate(templateKey, variables);
    
    if (!rendered) {
      console.error(`Failed to render template: ${templateKey}`);
      await logEmail({
        templateKey,
        emailType: emailType || templateKey,
        to,
        subject: `[Template Error] ${templateKey}`,
        bodyHtml: '',
        bodyText: '',
        status: 'failed',
        error: 'Template not found or inactive',
      });
      return { success: false, error: 'Template not found or inactive' };
    }

    const smtpSettings = await getSmtpSettings();
    const result = await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo,
      headers: customHeaders,
    });

    // Log email
    await logEmail({
      templateKey,
      emailType: emailType || templateKey,
      to,
      from: smtpSettings?.fromEmail || smtpSettings?.user,
      fromName: smtpSettings?.fromName,
      replyTo,
      subject: rendered.subject,
      bodyHtml: rendered.html,
      bodyText: rendered.text,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? undefined : (result.error as any)?.message || 'Unknown error',
      sentVia: (result as any).sentVia || (smtpSettings ? 'SMTP' : (resend ? 'Resend' : 'Dev')),
      metadata: { 
        ...(customHeaders || {}), 
        variables: variables, // Variablen speichern für Resend
      },
    });

    return result;
  } catch (error: any) {
    console.error(`Error sending email (${templateKey}):`, error);
    
    // Log failed email
    await logEmail({
      templateKey,
      emailType: emailType || templateKey,
      to,
      subject: `[Error] ${templateKey}`,
      bodyHtml: '',
      bodyText: '',
      status: 'failed',
      error: error.message,
    });
    
    return { success: false, error: error.message };
  }
}

// Password Reset Email
export async function sendPasswordResetEmail({
  to,
  token,
  name,
}: {
  to: string;
  token: string;
  name?: string;
}) {
  const appUrl = await getPublicUrl();
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
  const replyTo = await getReplyToEmail();
  
  return sendTemplatedEmail('password_reset', to, {
    adminName: name || to.split('@')[0],
    resetUrl,
    expiryMinutes: '60',
  }, replyTo, undefined, 'password_reset');
}

// Booking Confirmation (to Guest)
export async function sendBookingConfirmationToGuest({
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  numberOfAdults,
  numberOfChildren,
  totalPrice,
  guestCode,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  numberOfAdults: number;
  numberOfChildren?: number;
  totalPrice: number;
  guestCode?: string;
}) {
  const appUrl = await getPublicUrl();
  const statusUrl = `${appUrl}/booking/status?email=${encodeURIComponent(guestEmail)}&code=${bookingCode}`;
  const replyTo = await getReplyToEmail();
  
  const variables: Record<string, any> = {
    guestName: guestName || guestEmail.split('@')[0],
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    numberOfAdults: numberOfAdults.toString(),
    numberOfChildren: (numberOfChildren || 0).toString(),
    numberOfGuests: (numberOfAdults + (numberOfChildren || 0)).toString(), // Für Rückwärtskompatibilität mit Templates
    totalPrice: formatEmailPrice(totalPrice),
    statusUrl,
  };
  
  // Füge guestCode hinzu, falls vorhanden
  if (guestCode) {
    variables.guestCode = guestCode;
  }
  
  return sendTemplatedEmail('booking_confirmation', guestEmail, variables, replyTo, {
    'X-Booking-Code': bookingCode,
  }, 'booking_confirmation');
}

// Booking Approved
export async function sendBookingApprovalToGuest({
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  numberOfAdults,
  numberOfChildren,
  totalPrice,
  guestCode,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  numberOfAdults: number;
  numberOfChildren?: number;
  totalPrice: number;
  guestCode?: string;
}) {
  const replyTo = await getReplyToEmail();
  
  const variables: Record<string, any> = {
    guestName: guestName || guestEmail.split('@')[0],
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    numberOfAdults: numberOfAdults.toString(),
    numberOfChildren: (numberOfChildren || 0).toString(),
    numberOfGuests: (numberOfAdults + (numberOfChildren || 0)).toString(), // Für Rückwärtskompatibilität mit Templates
    totalPrice: formatEmailPrice(totalPrice),
    // adminNotes wird NICHT an Gäste gesendet - nur für interne Admin-Notizen
  };
  
  if (guestCode) {
    variables.guestCode = guestCode;
  }
  
  return sendTemplatedEmail('booking_approved', guestEmail, variables, replyTo, {
    'X-Booking-Code': bookingCode,
  }, 'booking_approved');
}

// Booking Rejected
export async function sendBookingRejectionToGuest({
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  rejectionReason,
  guestCode,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  rejectionReason?: string;
  guestCode?: string;
}) {
  const replyTo = await getReplyToEmail();
  
  const variables: Record<string, any> = {
    guestName: guestName || guestEmail.split('@')[0],
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    rejectionReason: rejectionReason || '',
  };
  
  if (guestCode) {
    variables.guestCode = guestCode;
  }
  
  return sendTemplatedEmail('booking_rejected', guestEmail, variables, replyTo, {
    'X-Booking-Code': bookingCode,
  }, 'booking_rejected');
}

// Booking Cancelled (to Guest)
export async function sendBookingCancellationToGuest({
  guestEmail,
  guestName,
  bookingCode,
  startDate,
  endDate,
  cancellationReason,
  guestCode,
}: {
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  cancellationReason?: string;
  guestCode?: string;
}) {
  const replyTo = await getReplyToEmail();
  
  const variables: Record<string, any> = {
    guestName: guestName || guestEmail.split('@')[0],
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    cancellationReason: cancellationReason || '',
  };
  
  if (guestCode) {
    variables.guestCode = guestCode;
  }
  
  return sendTemplatedEmail('booking_cancelled', guestEmail, variables, replyTo, {
    'X-Booking-Code': bookingCode,
  }, 'booking_cancelled');
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
  const appUrl = await getPublicUrl();
  const replyUrl = `${appUrl}/booking/status?email=${encodeURIComponent(guestEmail)}&code=${bookingCode}`;
  const replyTo = await getReplyToEmail();
  
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
    replyTo,
    {
      'X-Booking-Code': bookingCode,
    },
    'new_message'
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
  numberOfAdults,
  numberOfChildren,
  totalPrice,
  message,
  guestCode,
}: {
  adminEmail: string;
  guestEmail: string;
  guestName?: string;
  bookingCode: string;
  startDate: Date;
  endDate: Date;
  numberOfAdults: number;
  numberOfChildren?: number;
  totalPrice: number;
  message?: string;
  guestCode?: string;
}) {
  const appUrl = await getPublicUrl();
  const adminUrl = `${appUrl}/admin/bookings`;
  const replyTo = await getReplyToEmail();
  
  const variables: Record<string, any> = {
    guestName: guestName || guestEmail.split('@')[0],
    guestEmail,
    bookingCode,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    numberOfAdults: numberOfAdults.toString(),
    numberOfChildren: (numberOfChildren || 0).toString(),
    numberOfGuests: (numberOfAdults + (numberOfChildren || 0)).toString(), // Für Rückwärtskompatibilität mit Templates
    totalPrice: formatEmailPrice(totalPrice),
    message: message || '',
    adminUrl,
  };
  
  if (guestCode) {
    variables.guestCode = guestCode;
  }
  
  return sendTemplatedEmail('admin_new_booking', adminEmail, variables, replyTo, undefined, 'admin_new_booking');
}

// Booking Approved Notification (to Admin)
export async function sendBookingApprovedNotificationToAdmin({
  adminEmail,
  bookingCode,
  guestName,
  guestEmail,
  startDate,
  endDate,
  approvedByName,
  adminNotes,
}: {
  adminEmail: string;
  bookingCode: string;
  guestName?: string;
  guestEmail: string;
  startDate: Date;
  endDate: Date;
  approvedByName: string;
  adminNotes?: string;
}) {
  const appUrl = await getPublicUrl();
  // Finde Buchung über bookingCode um die ID zu bekommen
  const booking = await prisma.booking.findUnique({ 
    where: { bookingCode },
    select: { id: true, adminNotes: true },
  });
  const adminUrl = booking 
    ? `${appUrl}/admin/bookings/${booking.id}`
    : `${appUrl}/admin/bookings`;
  const replyTo = await getReplyToEmail();
  
  // Verwende adminNotes aus Parameter oder aus Datenbank
  const notes = adminNotes || booking?.adminNotes || '';
  
  return sendTemplatedEmail('admin_booking_approved', adminEmail, {
    bookingCode,
    guestName: guestName || guestEmail.split('@')[0],
    guestEmail,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    approvedByName,
    adminNotes: notes,
    adminUrl,
  }, replyTo, undefined, 'admin_booking_approved');
}

// Booking Rejected Notification (to Admin)
export async function sendBookingRejectedNotificationToAdmin({
  adminEmail,
  bookingCode,
  guestName,
  guestEmail,
  startDate,
  endDate,
  rejectedByName,
  rejectionReason,
  adminNotes,
}: {
  adminEmail: string;
  bookingCode: string;
  guestName?: string;
  guestEmail: string;
  startDate: Date;
  endDate: Date;
  rejectedByName: string;
  rejectionReason?: string;
  adminNotes?: string;
}) {
  const appUrl = await getPublicUrl();
  // Finde Buchung über bookingCode um die ID zu bekommen
  const booking = await prisma.booking.findUnique({ 
    where: { bookingCode },
    select: { id: true, adminNotes: true },
  });
  const adminUrl = booking 
    ? `${appUrl}/admin/bookings/${booking.id}`
    : `${appUrl}/admin/bookings`;
  const replyTo = await getReplyToEmail();
  
  // Verwende adminNotes aus Parameter oder aus Datenbank
  const notes = adminNotes || booking?.adminNotes || '';
  
  return sendTemplatedEmail('admin_booking_rejected', adminEmail, {
    bookingCode,
    guestName: guestName || guestEmail.split('@')[0],
    guestEmail,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    rejectedByName,
    rejectionReason: rejectionReason || '',
    adminNotes: notes,
    adminUrl,
  }, replyTo, undefined, 'admin_booking_rejected');
}

// Booking Conflict Notification (to Admin)
export async function sendBookingConflictNotificationToAdmin({
  adminEmail,
  conflictType,
  conflictDescription,
  bookings,
  calendarEvents,
  adminUrl,
}: {
  adminEmail: string;
  conflictType: "OVERLAPPING_REQUESTS" | "CALENDAR_CONFLICT" | "OVERLAPPING_CALENDAR_EVENTS";
  conflictDescription: string;
  bookings: Array<{
    bookingCode: string;
    guestName?: string | null;
    guestEmail: string;
    startDate: Date;
    endDate: Date;
    status: string;
  }>;
  calendarEvents?: Array<{
    id: string;
    summary: string;
    start: Date;
    end: Date;
  }>;
  adminUrl?: string;
}) {
  const appUrl = await getPublicUrl();
  const conflictsUrl = adminUrl || `${appUrl}/admin/bookings`;
  const replyTo = await getReplyToEmail();
  
  // Erstelle eine formatierte Liste der beteiligten Buchungen
  const bookingsList = bookings.map(booking => {
    const guestName = booking.guestName || booking.guestEmail.split('@')[0];
    return `• ${guestName} (${booking.bookingCode}): ${formatEmailDate(booking.startDate)} - ${formatEmailDate(booking.endDate)} [${booking.status}]`;
  }).join('\n');
  
  // Erstelle eine formatierte Liste der beteiligten Calendar Events
  const calendarEventsList = (calendarEvents || []).map(event => {
    const summary = event.summary || 'Unbenannter Eintrag';
    return `• ${summary}: ${formatEmailDate(event.start)} - ${formatEmailDate(event.end)}`;
  }).join('\n');
  
  // Kombiniere beide Listen
  const allItemsList = [
    ...(bookings.length > 0 ? [`Buchungen (${bookings.length}):`, bookingsList] : []),
    ...(calendarEvents && calendarEvents.length > 0 ? [`Manuelle Blockierungen (${calendarEvents.length}):`, calendarEventsList] : []),
  ].join('\n\n');
  
  let conflictTypeLabel = '';
  switch (conflictType) {
    case 'OVERLAPPING_REQUESTS':
      conflictTypeLabel = 'Überlappende Buchungen';
      break;
    case 'CALENDAR_CONFLICT':
      conflictTypeLabel = 'Kalender-Konflikt';
      break;
    case 'OVERLAPPING_CALENDAR_EVENTS':
      conflictTypeLabel = 'Überlappende Kalendereinträge';
      break;
  }
  
  const totalCount = bookings.length + (calendarEvents?.length || 0);
  
  return sendTemplatedEmail('admin_booking_conflict', adminEmail, {
    conflictType: conflictTypeLabel,
    conflictDescription,
    bookingsList: allItemsList,
    bookingsCount: totalCount.toString(),
    adminUrl: conflictsUrl,
    firstBookingCode: bookings[0]?.bookingCode || '',
  }, replyTo, undefined, 'admin_booking_conflict');
}

// Booking Cancelled Notification (to Admin)
export async function sendBookingCancelledNotificationToAdmin({
  adminEmail,
  bookingCode,
  guestName,
  guestEmail,
  startDate,
  endDate,
  cancelledByName,
  cancellationReason,
}: {
  adminEmail: string;
  bookingCode: string;
  guestName?: string;
  guestEmail: string;
  startDate: Date;
  endDate: Date;
  cancelledByName: string;
  cancellationReason?: string;
}) {
  const appUrl = await getPublicUrl();
  // Finde Buchung über bookingCode um die ID zu bekommen
  const booking = await prisma.booking.findUnique({ 
    where: { bookingCode },
    select: { id: true },
  });
  const adminUrl = booking 
    ? `${appUrl}/admin/bookings/${booking.id}`
    : `${appUrl}/admin/bookings`;
  const replyTo = await getReplyToEmail();
  
  return sendTemplatedEmail('admin_booking_cancelled', adminEmail, {
    bookingCode,
    guestName: guestName || guestEmail.split('@')[0],
    guestEmail,
    startDate: formatEmailDate(startDate),
    endDate: formatEmailDate(endDate),
    cancelledByName,
    cancellationReason: cancellationReason || '',
    adminUrl,
  }, replyTo, undefined, 'admin_booking_cancelled');
}

// New Message from Guest Notification (to Admin)
export async function sendNewMessageFromGuestNotificationToAdmin({
  adminEmail,
  bookingCode,
  guestName,
  guestEmail,
  messageContent,
}: {
  adminEmail: string;
  bookingCode: string;
  guestName?: string;
  guestEmail: string;
  messageContent: string;
}) {
  const appUrl = await getPublicUrl();
  const adminUrl = `${appUrl}/admin/bookings/${bookingCode}`;
  const replyTo = await getReplyToEmail();
  
  return sendTemplatedEmail('admin_new_message_from_guest', adminEmail, {
    bookingCode,
    guestName: guestName || guestEmail.split('@')[0],
    guestEmail,
    messageContent,
    adminUrl,
  }, replyTo, undefined, 'admin_new_message_from_guest');
}

// New User Welcome Email
export async function sendNewUserEmail({
  to,
  name,
  username,
  password,
  loginUrl,
  mustChangePassword,
}: {
  to: string;
  name: string;
  username: string;
  password: string;
  loginUrl: string;
  mustChangePassword: boolean;
}) {
  const replyTo = await getReplyToEmail();
  
  return sendTemplatedEmail('new_user', to, {
    userName: name,
    username,
    password,
    loginUrl: `${loginUrl}/auth/login`,
    mustChangePassword: mustChangePassword ? 'true' : 'false',
  }, replyTo, undefined, 'new_user');
}

// Magic Link Email
export async function sendMagicLinkEmail({
  to,
  token,
  name,
}: {
  to: string;
  token: string;
  name?: string;
}) {
  const appUrl = await getPublicUrl();
  const magicLink = `${appUrl}/auth/verify?token=${token}`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hollandhaus';
  const replyTo = await getReplyToEmail();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #2563eb;
            margin: 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
          .link {
            word-break: break-all;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${appName}</h1>
          </div>
          <div class="content">
            <h2>Hallo${name ? ` ${name}` : ''}</h2>
            <p>Sie haben einen Magic Link zum Einloggen angefordert.</p>
            <p>Klicken Sie auf den Button unten, um sich anzumelden:</p>
            <div style="text-align: center;">
              <a href="${magicLink}" class="button">Jetzt anmelden</a>
            </div>
            <p style="margin-top: 30px;">Oder kopieren Sie diesen Link in Ihren Browser:</p>
            <p class="link">${magicLink}</p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden.
            </p>
            <p style="color: #666; font-size: 14px;">
              Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${appName}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Hallo${name ? ` ${name}` : ''}!

Sie haben einen Magic Link zum Einloggen angefordert.

Klicken Sie auf diesen Link, um sich anzumelden:
${magicLink}

Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden.

Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.

© ${new Date().getFullYear()} ${appName}
  `;

  return sendEmail({
    to,
    subject: `Ihr Magic Link für ${appName}`,
    html: htmlContent,
    text: textContent,
    replyTo,
  });
}

// Send to all admins (legacy - nutzt jetzt Benachrichtigungseinstellungen wenn möglich)
export async function notifyAllAdmins(
  templateKey: string,
  variables: Record<string, any>,
  notificationType?: "newBooking" | "bookingApproved" | "bookingRejected"
) {
  try {
    const prisma = (await import('./prisma')).default;
    
    // Wenn notificationType angegeben, nur Admins mit aktivierter Benachrichtigung benachrichtigen
    let adminEmails: string[] = [];
    
    if (notificationType) {
      const { getAdminsToNotify } = await import('./notifications');
      adminEmails = await getAdminsToNotify(notificationType);
    } else {
      // Fallback: Alle aktiven Admins
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { email: true },
      });
      adminEmails = admins.map((admin) => admin.email);
    }

    const replyTo = await getReplyToEmail();

    const results = await Promise.all(
      adminEmails.map((email) =>
        sendTemplatedEmail(templateKey, email, variables, replyTo, undefined, templateKey)
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

