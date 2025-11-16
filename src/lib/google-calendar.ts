import { google } from 'googleapis';
import { formatDate } from '@/lib/utils';
import prisma from '@/lib/prisma';

// Google Calendar Client initialisieren (von ENV oder Datenbank)
async function getGoogleCalendarClientFromDB() {
  // Zuerst versuchen, aus Datenbank zu laden
  const [serviceAccountSetting, calendarIdSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'GOOGLE_SERVICE_ACCOUNT' } }),
    prisma.setting.findUnique({ where: { key: 'GOOGLE_CALENDAR_ID' } }),
  ]);

  if (serviceAccountSetting?.value) {
    try {
      const credentials = JSON.parse(serviceAccountSetting.value);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
      return google.calendar({ version: 'v3', auth });
    } catch (error) {
      console.error('Error parsing credentials from database:', error);
    }
  }

  // Fallback auf ENV-Variablen
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.warn('Google Calendar credentials not configured');
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error);
    return null;
  }
}

// Synchrone Version für Kompatibilität (verwendet ENV nur)
function getGoogleCalendarClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.warn('Google Calendar credentials not configured');
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error);
    return null;
  }
}

// Exportierte Funktion für neue Actions
export async function getCalendarClient() {
  return await getGoogleCalendarClientFromDB();
}

// Calendar-ID aus Datenbank oder ENV abrufen
export async function getCalendarId(): Promise<string | null> {
  // Zuerst aus Datenbank versuchen
  const setting = await prisma.setting.findUnique({
    where: { key: 'GOOGLE_CALENDAR_ID' },
  });
  
  if (setting?.value) {
    return setting.value;
  }
  
  // Fallback auf ENV
  return process.env.GOOGLE_CALENDAR_ID || null;
}

interface CreateEventParams {
  summary: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  guestEmail?: string;
  guestName?: string;
}

// Event im Google Calendar erstellen
export async function createCalendarEvent({
  summary,
  description,
  startDate,
  endDate,
  guestEmail,
  guestName,
}: CreateEventParams): Promise<string | null> {
  // Nutze Datenbank-Credentials (oder Fallback auf ENV)
  const calendar = await getCalendarClient();
  if (!calendar) {
    console.warn('Google Calendar not available, skipping event creation');
    return null;
  }

  const calendarId = await getCalendarId();
  if (!calendarId) {
    console.warn('GOOGLE_CALENDAR_ID not configured');
    return null;
  }

  try {
    // Note: Service Accounts können keine attendees hinzufügen ohne Domain-Wide Delegation
    // Daher fügen wir Gast-Info nur in die Beschreibung ein
    const fullDescription = description 
      ? `${description}\n\nGast: ${guestName || guestEmail}`
      : `Gast: ${guestName || guestEmail}`;

    const event = {
      summary,
      description: fullDescription,
      start: {
        date: startDate.toISOString().split('T')[0],
        timeZone: 'Europe/Amsterdam',
      },
      end: {
        date: endDate.toISOString().split('T')[0],
        timeZone: 'Europe/Amsterdam',
      },
      // attendees entfernt - Service Accounts können keine Einladungen senden
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 Tag vorher
          { method: 'popup', minutes: 60 }, // 1 Stunde vorher
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data.id || null;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

// Event im Google Calendar aktualisieren
export async function updateCalendarEvent(
  eventId: string,
  params: Partial<CreateEventParams> & { colorId?: string }
): Promise<boolean> {
  const calendar = await getCalendarClient();
  if (!calendar) return false;

  const calendarId = await getCalendarId();
  if (!calendarId) return false;

  try {
    const updateData: any = {};

    if (params.summary) updateData.summary = params.summary;
    if (params.description) updateData.description = params.description;
    if (params.colorId !== undefined) {
      // Leerer String = Farbe entfernen (auf Standardfarbe zurücksetzen)
      updateData.colorId = params.colorId === '' ? null : params.colorId;
    }
    if (params.startDate) {
      updateData.start = {
        date: params.startDate.toISOString().split('T')[0],
        timeZone: 'Europe/Amsterdam',
      };
    }
    if (params.endDate) {
      updateData.end = {
        date: params.endDate.toISOString().split('T')[0],
        timeZone: 'Europe/Amsterdam',
      };
    }

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updateData,
    });

    return true;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return false;
  }
}

// Event aus Google Calendar löschen
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const calendar = await getCalendarClient();
  if (!calendar) return false;

  const calendarId = await getCalendarId();
  if (!calendarId) return false;

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  colorId?: string; // Google Calendar Farb-ID
}

// Alle Events aus Google Calendar abrufen
export async function getCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  const calendar = await getCalendarClient();
  if (!calendar) return [];

  const calendarId = await getCalendarId();
  if (!calendarId) return [];

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500, // Max 2500 Events (Google API Limit)
    });

    const events = response.data.items || [];

    return events.map((event) => {
      // Google Calendar gibt bei ganztägigen Events das End-Datum als "exclusive" zurück
      // z.B. Event von 7. bis 9. November wird als end="2025-11-10" zurückgegeben
      // Wir müssen einen Tag abziehen, um das korrekte inklusive End-Datum zu erhalten
      let endDate: Date;
      if (event.end?.date) {
        // Ganztägiges Event: End-Datum um einen Tag reduzieren
        const end = new Date(event.end.date);
        end.setDate(end.getDate() - 1);
        endDate = end;
      } else if (event.end?.dateTime) {
        // Event mit Zeit: End-Datum direkt verwenden
        endDate = new Date(event.end.dateTime);
      } else {
        // Fallback
        endDate = new Date(event.end?.date || '');
      }

      return {
        id: event.id || '',
        summary: event.summary || '',
        description: event.description || undefined,
        start: new Date(event.start?.date || event.start?.dateTime || ''),
        end: endDate,
        colorId: event.colorId || undefined, // Farb-ID aus Google Calendar
      };
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}


/**
 * Holt alle blockierten Termine aus Google Calendar
 * Filtert Events mit colorId=10 (Grün) aus, da diese als "nicht blockierend" gelten
 */
export async function getBlockedDatesFromCalendar(): Promise<Array<{
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  colorId?: string;
}>> {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // 1 Monat zurück
    
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 2); // 2 Jahre in die Zukunft

    const events = await getCalendarEvents(startDate, endDate);

    // Filtere informational Events (colorId=10 = Grün) aus
    const blockingEvents = events.filter(event => event.colorId !== '10');

    return blockingEvents;
  } catch (error) {
    console.error('Error fetching blocked dates from calendar:', error);
    return [];
  }
}

