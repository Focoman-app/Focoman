import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('PWA manifest.json configuration and icon assets integrity', async (t) => {
  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, 'apps/web/public/manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in apps/web/public');

  const rawManifest = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(rawManifest);

  await t.test('manifest metadata conforms to user requirements', () => {
    assert.equal(manifest.name, 'Focoman Studios');
    assert.equal(manifest.short_name, 'Focoman');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, '#18181B');
    assert.equal(manifest.background_color, '#FFFFFF');
    assert.equal(manifest.start_url, '/');
  });

  await t.test('manifest specifies any and maskable launcher icons', () => {
    assert.ok(Array.isArray(manifest.icons), 'icons must be an array');
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    assert.ok(purposes.includes('any'), 'Must include standard "any" icons');
    assert.ok(purposes.includes('maskable'), 'Must include Android "maskable" icons');

    for (const icon of manifest.icons) {
      const iconPath = path.join(rootDir, 'apps/web/public', icon.src);
      assert.ok(fs.existsSync(iconPath), `Icon file must exist: ${icon.src}`);
      const stats = fs.statSync(iconPath);
      assert.ok(stats.size > 500, `Icon file must have authentic non-zero size: ${icon.src}`);
    }
  });

  await t.test('manifest defines quick app shortcuts', () => {
    assert.ok(Array.isArray(manifest.shortcuts), 'shortcuts must be an array');
    assert.ok(manifest.shortcuts.length >= 2, 'Should define at least 2 quick shortcuts');
    const urls = manifest.shortcuts.map((s: { url: string }) => s.url);
    assert.ok(urls.includes('/dashboard'), 'Dashboard shortcut should exist');
    assert.ok(urls.includes('/track'), 'Track shortcut should exist');
  });

  await t.test('Service Worker sw.js exists and includes core lifecycle handlers', () => {
    const swPath = path.join(rootDir, 'apps/web/public/sw.js');
    assert.ok(fs.existsSync(swPath), 'sw.js must exist in apps/web/public');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    assert.ok(swContent.includes("addEventListener('install'"), 'sw.js must have install listener');
    assert.ok(swContent.includes("addEventListener('activate'"), 'sw.js must have activate listener');
    assert.ok(swContent.includes("addEventListener('fetch'"), 'sw.js must have fetch listener');
    assert.ok(swContent.includes('/offline'), 'sw.js must support offline fallback');
  });

  await t.test('Apple touch icon exists for iOS devices', () => {
    const appleIconPath = path.join(rootDir, 'apps/web/public/apple-touch-icon.png');
    assert.ok(fs.existsSync(appleIconPath), 'apple-touch-icon.png must exist');
    const stats = fs.statSync(appleIconPath);
    assert.ok(stats.size > 1000, 'apple-touch-icon.png must be a valid high-res image');
  });
});

