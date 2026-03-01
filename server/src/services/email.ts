import { config } from '../config.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (config.email.provider === 'console') {
    console.log('=== EMAIL (console provider) ===');
    console.log(`To: ${message.to}`);
    if (message.replyTo) console.log(`Reply-To: ${message.replyTo}`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Body: ${message.text}`);
    if (message.html) console.log(`HTML: (${message.html.length} chars)`);
    if (message.attachments?.length) {
      for (const att of message.attachments) {
        console.log(`Attachment: ${att.filename} (${att.content.length} bytes, ${att.contentType})`);
      }
    }
    console.log('================================');
    return;
  }

  throw new Error(`Email provider "${config.email.provider}" not yet implemented`);
}

export function generateVerificationCode(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return digits.toString();
}
