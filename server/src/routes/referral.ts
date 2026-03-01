/**
 * Counselor Referral routes.
 *
 * Lets a service member email their Financial Readiness Summary PDF
 * to an installation Personal Financial Counselor (PFC) or advisor.
 * The PDF is generated client-side and sent as a base64-encoded attachment.
 * Server never persists or inspects the PDF content — it's transient.
 *
 * Endpoints:
 *   POST /referral/send — Send summary PDF to counselor via email
 */

import { FastifyInstance } from 'fastify';
import { requireAuth, type JwtPayload } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit-log.js';
import { sendEmail } from '../services/email.js';

interface AuthenticatedRequest {
  user: JwtPayload;
}

// --- Constants ---

const MAX_MESSAGE_LENGTH = 500;
const MAX_PDF_BASE64_SIZE = 5 * 1024 * 1024; // 5MB base64 ≈ ~3.75MB PDF
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Validation ---

export function validateReferralInput(
  body: unknown,
): { counselorEmail: string; message: string; pdfBase64: string } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body is required' };
  }

  const { counselorEmail, message, pdfBase64 } = body as Record<string, unknown>;

  // counselorEmail: required, valid format
  if (!counselorEmail || typeof counselorEmail !== 'string') {
    return { error: 'counselorEmail is required' };
  }
  const trimmedEmail = counselorEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { error: 'Invalid email format for counselorEmail' };
  }

  // message: optional, max length
  let sanitizedMessage = '';
  if (message !== undefined && message !== null) {
    if (typeof message !== 'string') {
      return { error: 'message must be a string' };
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return { error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };
    }
    sanitizedMessage = message.trim();
  }

  // pdfBase64: required, non-empty, size check
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return { error: 'pdfBase64 is required' };
  }
  if (pdfBase64.length === 0) {
    return { error: 'pdfBase64 must not be empty' };
  }
  if (pdfBase64.length > MAX_PDF_BASE64_SIZE) {
    return { error: 'PDF exceeds maximum size (5MB)' };
  }

  return { counselorEmail: trimmedEmail, message: sanitizedMessage, pdfBase64 };
}

// --- Email HTML builder ---

export function buildReferralEmailHtml(userEmail: string, message: string): string {
  const messageSection = message
    ? `<div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #1e3a5f;border-radius:4px;">
        <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Message from service member:</p>
        <p style="margin:0;font-size:14px;color:#111827;">${escapeHtml(message)}</p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e3a5f;padding:16px 24px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:bold;">FORTRESS</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Financial Readiness Summary</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 12px;font-size:15px;">
        A service member (<strong>${escapeHtml(userEmail)}</strong>) has shared their
        Financial Readiness Summary with you for review.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;">
        The summary PDF is attached to this email. It includes their risk assessment,
        action plan, and financial highlights.
      </p>
      ${messageSection}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
      <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#1e3a5f;">Counselor Resources</p>
      <ul style="margin:0;padding:0 0 0 16px;font-size:13px;color:#475569;line-height:1.6;">
        <li>Installation Personal Financial Counselor (PFC)</li>
        <li>Military OneSource: 1-800-342-9647 / militaryonesource.mil</li>
        <li>CFPB Military: consumerfinance.gov/military</li>
      </ul>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
        This document contains sensitive financial information. Handle accordingly.
        Fortress provides financial planning tools, not financial advice.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Routes ---

export async function referralRoutes(app: FastifyInstance) {
  app.post(
    '/referral/send',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const result = validateReferralInput(request.body);
      if ('error' in result) {
        return reply.status(400).send({ error: 'Validation failed', message: result.error });
      }

      const { counselorEmail, message, pdfBase64 } = result;

      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const dateTag = new Date().toISOString().slice(0, 10);

      const html = buildReferralEmailHtml(user.email, message);

      const textBody = [
        `A service member (${user.email}) has shared their Financial Readiness Summary with you.`,
        '',
        'The summary PDF is attached to this email.',
        message ? `\nMessage from service member:\n${message}\n` : '',
        '---',
        'Counselor Resources:',
        '• Installation Personal Financial Counselor (PFC)',
        '• Military OneSource: 1-800-342-9647 / militaryonesource.mil',
        '• CFPB Military: consumerfinance.gov/military',
        '',
        'This document contains sensitive financial information. Handle accordingly.',
      ].join('\n');

      await sendEmail({
        to: counselorEmail,
        subject: 'Fortress — Financial Readiness Summary',
        text: textBody,
        html,
        replyTo: user.email,
        attachments: [
          {
            filename: `fortress-summary-${dateTag}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      auditLog('referral_email_sent', request, {
        userId: user.userId,
        counselorEmail,
      });

      return reply.status(200).send({ message: 'Referral email sent successfully' });
    },
  );
}
