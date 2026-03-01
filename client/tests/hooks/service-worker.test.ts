/**
 * Tests for PWA configuration.
 *
 * The useServiceWorker hook uses `virtual:pwa-register` which is only
 * available during Vite builds (not Vitest). We test the static PWA
 * configuration (manifest, icons) and verify the hook file exports correctly
 * at the source level.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PWA manifest', () => {
  const manifestPath = path.resolve(__dirname, '../../public/manifest.json');

  it('manifest.json exists in public/', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it('has required PWA fields', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.name).toBe('Fortress — Financial Readiness');
    expect(manifest.short_name).toBe('Fortress');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#1e3a5f');
    expect(manifest.background_color).toBe('#0f172a');
  });

  it('has at least one icon', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
  });

  it('icons reference existing files', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const publicDir = path.resolve(__dirname, '../../public');
    for (const icon of manifest.icons) {
      const iconPath = path.join(publicDir, icon.src);
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });
});

describe('PWA index.html', () => {
  const htmlPath = path.resolve(__dirname, '../../index.html');

  it('has manifest link', () => {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.json"');
  });

  it('has theme-color meta', () => {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('content="#1e3a5f"');
  });

  it('has apple-touch-icon', () => {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});

describe('PWA hook source', () => {
  it('useServiceWorker.ts exists', () => {
    const hookPath = path.resolve(__dirname, '../../src/hooks/useServiceWorker.ts');
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  it('hook source imports virtual:pwa-register dynamically', () => {
    const hookPath = path.resolve(__dirname, '../../src/hooks/useServiceWorker.ts');
    const source = fs.readFileSync(hookPath, 'utf-8');
    // Must use dynamic import (not static) so it doesn't break tests
    expect(source).toContain("import('virtual:pwa-register')");
    expect(source).not.toMatch(/^import .* from ['"]virtual:pwa-register/m);
  });
});
