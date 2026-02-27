import { config } from '../config.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (config.email.provider === 'console') {
    console.log('=== EMAIL (console provider) ===');
    console.log(`To: ${message.to}`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Body: ${message.text}`);
    console.log('================================');
    return;
  }

  throw new Error(`Email provider "${config.email.provider}" not yet implemented`);
}

export function generateVerificationCode(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return digits.toString();
}
