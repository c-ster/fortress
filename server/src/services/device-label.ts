/**
 * Pure function to parse User-Agent strings into human-readable device labels.
 * Separated from device.ts for testability.
 */

/** Parse a User-Agent string into a short label like "Chrome 120 on macOS". */
export function parseDeviceLabel(userAgent: string): string {
  if (!userAgent) return 'Unknown device';

  let browser = 'Unknown browser';
  let os = 'Unknown OS';

  // Browser detection (order matters — Chrome UA includes Safari)
  const edgeMatch = userAgent.match(/Edg\/(\d+)/);
  const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
  const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
  const safariMatch = userAgent.match(/Version\/(\d+).*Safari/);

  if (edgeMatch) {
    browser = `Edge ${edgeMatch[1]}`;
  } else if (chromeMatch) {
    browser = `Chrome ${chromeMatch[1]}`;
  } else if (firefoxMatch) {
    browser = `Firefox ${firefoxMatch[1]}`;
  } else if (safariMatch) {
    browser = `Safari ${safariMatch[1]}`;
  }

  // OS detection (iOS before macOS — iOS UA contains "Mac OS X")
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    os = 'iOS';
  } else if (/Macintosh|Mac OS X/.test(userAgent)) {
    os = 'macOS';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (/Windows/.test(userAgent)) {
    os = 'Windows';
  } else if (/Linux/.test(userAgent)) {
    os = 'Linux';
  }

  if (browser === 'Unknown browser' && os === 'Unknown OS') {
    return 'Unknown device';
  }

  return `${browser} on ${os}`;
}
