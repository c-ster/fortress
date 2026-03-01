/**
 * Client-side device fingerprinting.
 *
 * Collects stable browser properties, hashes them via Web Crypto SHA-256,
 * and returns a 64-character hex string as the device identifier.
 * No external dependencies — uses only browser APIs.
 */

export interface FingerprintComponents {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  hardwareConcurrency: number;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  pixelRatio: number;
  timezoneOffset: number;
  timezone: string;
  touchSupport: boolean;
  cookieEnabled: boolean;
}

/** Collect raw browser properties for fingerprinting. */
export function collectFingerprintComponents(): FingerprintComponents {
  return {
    userAgent: navigator.userAgent ?? '',
    language: navigator.language ?? '',
    languages: Array.from(navigator.languages ?? []),
    platform: navigator.platform ?? '',
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    screenWidth: screen.width ?? 0,
    screenHeight: screen.height ?? 0,
    colorDepth: screen.colorDepth ?? 0,
    pixelRatio: window.devicePixelRatio ?? 1,
    timezoneOffset: new Date().getTimezoneOffset(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    touchSupport: 'ontouchstart' in window,
    cookieEnabled: navigator.cookieEnabled ?? false,
  };
}

/** Convert an ArrayBuffer to a hex string. */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hex.join('');
}

/**
 * Generate a stable device fingerprint as a 64-char hex SHA-256 hash.
 * Async because Web Crypto's digest is async.
 */
export async function generateFingerprint(): Promise<string> {
  const components = collectFingerprintComponents();

  // Deterministic JSON: sort keys alphabetically
  const keys = Object.keys(components).sort() as (keyof FingerprintComponents)[];
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = components[key];
  }

  const json = JSON.stringify(sorted);
  const encoded = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToHex(hashBuffer);
}

/**
 * Derive a human-readable device label from the current browser.
 * e.g. "Chrome 120 on macOS"
 */
export function deriveDeviceLabel(): string {
  const ua = navigator.userAgent ?? '';
  return parseUserAgentLabel(ua);
}

/** Parse a User-Agent string into a short label. */
export function parseUserAgentLabel(ua: string): string {
  if (!ua) return 'Unknown device';

  let browser = 'Unknown browser';
  let os = 'Unknown OS';

  // Browser detection (order matters — Chrome UA includes Safari)
  if (/Edg\/(\d+)/.test(ua)) {
    browser = `Edge ${RegExp.$1}`;
  } else if (/Chrome\/(\d+)/.test(ua)) {
    browser = `Chrome ${RegExp.$1}`;
  } else if (/Firefox\/(\d+)/.test(ua)) {
    browser = `Firefox ${RegExp.$1}`;
  } else if (/Version\/(\d+).*Safari/.test(ua)) {
    browser = `Safari ${RegExp.$1}`;
  }

  // OS detection (iOS before macOS — iOS UA contains "Mac OS X")
  if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/Windows/.test(ua)) {
    os = 'Windows';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  if (browser === 'Unknown browser' && os === 'Unknown OS') {
    return 'Unknown device';
  }

  return `${browser} on ${os}`;
}
