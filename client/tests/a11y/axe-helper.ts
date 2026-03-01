/**
 * Axe-core test helper for WCAG 2.1 AA compliance.
 *
 * Provides a `checkA11y()` utility that runs automated accessibility
 * checks against rendered React components using axe-core.
 */

import { configureAxe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { expect } from 'vitest';

// Extend Vitest matchers with toHaveNoViolations
expect.extend(matchers);

/**
 * Pre-configured axe instance targeting WCAG 2.1 AA.
 * Disables rules that are not automatable or cause false positives in jsdom.
 */
export const axe = configureAxe({
  rules: {
    // Region rule requires all content in landmarks — not enforced in unit tests
    // because we render fragments, not full pages
    region: { enabled: false },
    // Color contrast cannot be reliably checked in jsdom (no computed styles)
    'color-contrast': { enabled: false },
  },
});
