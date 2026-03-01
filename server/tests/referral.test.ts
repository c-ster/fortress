import { describe, it, expect } from 'vitest';
import { validateReferralInput, buildReferralEmailHtml } from '../src/routes/referral';

// --- validateReferralInput ---

describe('validateReferralInput', () => {
  const validBody = {
    counselorEmail: 'counselor@base.mil',
    message: 'Please review my financial readiness summary.',
    pdfBase64: 'JVBERi0xLjQK', // minimal base64 string
  };

  it('accepts valid input with all fields', () => {
    const result = validateReferralInput(validBody);
    expect(result).toEqual({
      counselorEmail: 'counselor@base.mil',
      message: 'Please review my financial readiness summary.',
      pdfBase64: 'JVBERi0xLjQK',
    });
  });

  it('accepts input without optional message', () => {
    const result = validateReferralInput({
      counselorEmail: 'pfc@installation.mil',
      pdfBase64: 'JVBERi0xLjQK',
    });
    expect(result).toEqual({
      counselorEmail: 'pfc@installation.mil',
      message: '',
      pdfBase64: 'JVBERi0xLjQK',
    });
  });

  it('normalizes email (trim + lowercase)', () => {
    const result = validateReferralInput({
      ...validBody,
      counselorEmail: '  Counselor@Base.MIL  ',
    });
    expect(result).not.toHaveProperty('error');
    expect((result as { counselorEmail: string }).counselorEmail).toBe('counselor@base.mil');
  });

  it('trims message whitespace', () => {
    const result = validateReferralInput({
      ...validBody,
      message: '  Please review.  ',
    });
    expect(result).not.toHaveProperty('error');
    expect((result as { message: string }).message).toBe('Please review.');
  });

  it('rejects missing body', () => {
    expect(validateReferralInput(null)).toEqual({ error: 'Request body is required' });
    expect(validateReferralInput(undefined)).toEqual({ error: 'Request body is required' });
  });

  it('rejects missing counselorEmail', () => {
    const result = validateReferralInput({ pdfBase64: 'abc123' });
    expect(result).toEqual({ error: 'counselorEmail is required' });
  });

  it('rejects invalid email format', () => {
    const result = validateReferralInput({
      ...validBody,
      counselorEmail: 'not-an-email',
    });
    expect(result).toEqual({ error: 'Invalid email format for counselorEmail' });
  });

  it('rejects missing pdfBase64', () => {
    const result = validateReferralInput({
      counselorEmail: 'pfc@base.mil',
    });
    expect(result).toEqual({ error: 'pdfBase64 is required' });
  });

  it('rejects empty pdfBase64', () => {
    const result = validateReferralInput({
      counselorEmail: 'pfc@base.mil',
      pdfBase64: '',
    });
    expect(result).toEqual({ error: 'pdfBase64 is required' });
  });

  it('rejects oversized pdfBase64 (> 5MB)', () => {
    const result = validateReferralInput({
      counselorEmail: 'pfc@base.mil',
      pdfBase64: 'A'.repeat(5 * 1024 * 1024 + 1),
    });
    expect(result).toEqual({ error: 'PDF exceeds maximum size (5MB)' });
  });

  it('rejects message exceeding 500 characters', () => {
    const result = validateReferralInput({
      ...validBody,
      message: 'A'.repeat(501),
    });
    expect(result).toEqual({ error: 'message must be 500 characters or fewer' });
  });

  it('accepts message at exactly 500 characters', () => {
    const result = validateReferralInput({
      ...validBody,
      message: 'A'.repeat(500),
    });
    expect(result).not.toHaveProperty('error');
  });

  it('rejects non-string message', () => {
    const result = validateReferralInput({
      ...validBody,
      message: 123,
    });
    expect(result).toEqual({ error: 'message must be a string' });
  });
});

// --- buildReferralEmailHtml ---

describe('buildReferralEmailHtml', () => {
  it('includes counselor greeting and user email', () => {
    const html = buildReferralEmailHtml('sm@army.mil', '');
    expect(html).toContain('sm@army.mil');
    expect(html).toContain('Financial Readiness Summary');
  });

  it('includes user message when provided', () => {
    const html = buildReferralEmailHtml('sm@army.mil', 'Please review before our appointment.');
    expect(html).toContain('Please review before our appointment.');
    expect(html).toContain('Message from service member');
  });

  it('omits message section when message is empty', () => {
    const html = buildReferralEmailHtml('sm@army.mil', '');
    expect(html).not.toContain('Message from service member');
  });

  it('includes counselor resources', () => {
    const html = buildReferralEmailHtml('sm@army.mil', '');
    expect(html).toContain('Counselor Resources');
    expect(html).toContain('Military OneSource');
    expect(html).toContain('consumerfinance.gov/military');
  });

  it('escapes HTML in user email', () => {
    const html = buildReferralEmailHtml('<script>alert(1)</script>@test.com', '');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in user message', () => {
    const html = buildReferralEmailHtml('sm@army.mil', '<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('includes FORTRESS branding', () => {
    const html = buildReferralEmailHtml('sm@army.mil', '');
    expect(html).toContain('FORTRESS');
  });

  it('includes confidentiality notice', () => {
    const html = buildReferralEmailHtml('sm@army.mil', '');
    expect(html).toContain('sensitive financial information');
  });
});
