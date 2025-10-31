/**
 * Development Email Store
 * Speichert alle gesendeten Emails in-memory für Development
 */

export interface DevEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  timestamp: Date;
}

class DevMailStore {
  private emails: DevEmail[] = [];
  private maxEmails = 100; // Limit für Memory

  add(email: Omit<DevEmail, 'id' | 'timestamp'>) {
    const devEmail: DevEmail = {
      ...email,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
    };

    this.emails.unshift(devEmail);

    // Limit einhalten
    if (this.emails.length > this.maxEmails) {
      this.emails = this.emails.slice(0, this.maxEmails);
    }

    // In Konsole loggen
    console.log('\n📧 DEV EMAIL SENT:');
    console.log('To:', email.to);
    console.log('Subject:', email.subject);
    console.log('---');
    console.log(email.text);
    console.log('\n📬 View all emails: http://localhost:3000/dev/emails\n');

    return devEmail;
  }

  getAll(): DevEmail[] {
    return [...this.emails];
  }

  getById(id: string): DevEmail | undefined {
    return this.emails.find(e => e.id === id);
  }

  clear() {
    this.emails = [];
  }
}

// Use global to persist across hot reloads in development
const globalForDevMail = global as unknown as { 
  devMailStore?: DevMailStore 
};

export const devMailStore = globalForDevMail.devMailStore || new DevMailStore();

if (process.env.NODE_ENV !== 'production') {
  globalForDevMail.devMailStore = devMailStore;
}

