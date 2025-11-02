import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendEmail, sendTemplatedEmail } from "@/lib/email";
import { getReplyToEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { id } = params;

    // E-Mail-Log laden
    const emailLog = await prisma.emailLog.findUnique({
      where: { id },
    });

    if (!emailLog) {
      return NextResponse.json(
        { error: "E-Mail-Log nicht gefunden" },
        { status: 404 }
      );
    }

    let result;
    
    // Wenn ein Template-Key vorhanden ist, versuche das Template neu zu rendern
    if (emailLog.templateKey) {
      try {
        // Variablen aus Metadata extrahieren oder aus User-Daten rekonstruieren
        const metadata = (emailLog.metadata as Record<string, any>) || {};
        let variables = metadata.variables || {};
        
        // Spezialfall: new_user - User-Daten aus DB holen und neues Passwort generieren
        if (emailLog.templateKey === 'new_user') {
          const dbUser = await prisma.user.findUnique({
            where: { email: emailLog.to },
            select: { id: true, name: true, username: true, mustChangePassword: true },
          });
          
          if (dbUser) {
            // Neues Passwort generieren
            const { generateSecurePassword } = await import('@/lib/password-generator');
            const bcrypt = await import('bcryptjs');
            const newPassword = generateSecurePassword();
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            // Passwort in DB aktualisieren und mustChangePassword setzen
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                password: hashedPassword,
                mustChangePassword: true,
              },
            });
            
            const publicUrl = await (await import('@/lib/email')).getPublicUrl();
            variables = {
              userName: dbUser.name || emailLog.to.split('@')[0],
              username: dbUser.username || emailLog.to.split('@')[0],
              password: newPassword, // Neues Passwort in E-Mail
              loginUrl: `${publicUrl}/auth/login`,
              mustChangePassword: 'true',
            };
          }
        }
        
        if (variables && Object.keys(variables).length > 0) {
          // Template neu rendern und versenden
          const replyTo = await getReplyToEmail();
          result = await sendTemplatedEmail(
            emailLog.templateKey,
            emailLog.to,
            variables,
            emailLog.replyTo || replyTo || undefined,
            (metadata && typeof metadata === 'object' && 'headers' in metadata)
              ? (metadata.headers as Record<string, string>)
              : undefined,
            emailLog.emailType
          );
        } else {
          throw new Error('Keine Variablen gefunden');
        }
      } catch (templateError) {
        console.error("Failed to resend using template, falling back to raw content:", templateError);
        // Fallback: Alten Content erneut senden
        result = await sendEmail({
          to: emailLog.to,
          subject: emailLog.subject.replace(/^\[Erneut gesendet\]\s*/, '').replace(/^\[Template Error\]\s*/, ''),
          html: emailLog.bodyHtml,
          text: emailLog.bodyText,
          replyTo: emailLog.replyTo || undefined,
          headers: (emailLog.metadata && typeof emailLog.metadata === 'object' && 'headers' in emailLog.metadata)
            ? (emailLog.metadata.headers as Record<string, string>)
            : undefined,
        });
      }
    } else {
      // Kein Template-Key: Alten Content erneut senden
      result = await sendEmail({
        to: emailLog.to,
        subject: emailLog.subject,
        html: emailLog.bodyHtml,
        text: emailLog.bodyText,
        replyTo: emailLog.replyTo || undefined,
        headers: (emailLog.metadata && typeof emailLog.metadata === 'object' && 'headers' in emailLog.metadata)
          ? (emailLog.metadata.headers as Record<string, string>)
          : undefined,
      });
    }

    if (result.success) {
      // sendTemplatedEmail erstellt bereits einen Log-Eintrag, 
      // also müssen wir keinen zweiten erstellen
      // Nur Activity Log erstellen
      const latestLog = await prisma.emailLog.findFirst({
        where: { to: emailLog.to, emailType: emailLog.emailType },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      // Activity Log
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "EMAIL_RESENT",
          entity: "EmailLog",
          entityId: latestLog?.id || emailLog.id,
          details: { originalLogId: emailLog.id, emailType: emailLog.emailType },
        },
      });

      return NextResponse.json({
        success: true,
        emailLog: latestLog || emailLog,
      });
    } else {
      // Fehler-Log erstellen
      await prisma.emailLog.create({
        data: {
          templateKey: emailLog.templateKey,
          emailType: emailLog.emailType,
          to: emailLog.to,
          from: emailLog.from,
          fromName: emailLog.fromName,
          replyTo: emailLog.replyTo,
          subject: `[Fehler beim erneuten Senden] ${emailLog.subject}`,
          bodyHtml: emailLog.bodyHtml,
          bodyText: emailLog.bodyText,
          status: "failed",
          error: (result.error as any)?.message || "Unknown error",
          sentVia: emailLog.sentVia || "SMTP",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: (result.error as any)?.message || "E-Mail konnte nicht erneut versendet werden",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error resending email:", error);
    return NextResponse.json(
      { error: "Fehler beim erneuten Versenden der E-Mail" },
      { status: 500 }
    );
  }
}

