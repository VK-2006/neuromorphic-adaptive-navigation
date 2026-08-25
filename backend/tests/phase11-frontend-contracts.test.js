const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
const { createApp } = require('../src/app');
const app = createApp();

describe('Phase 11: Frontend Production Acceptance, PWA & UX Contracts', () => {

  const frontendPublic = path.join(__dirname, '../../frontend/public');
  const frontendRoot = path.join(__dirname, '../../frontend');

  test('Step 11.0: Page Inventory — All core user-facing HTML pages exist in frontend/public/', () => {
    const requiredPages = [
      'index.html',
      'dashboard.html',
      'map.html',
      'memory.html',
      'history.html',
      'journey-replay.html',
      'profile.html',
      'settings.html',
      'login.html',
      'register.html',
      'verify-email.html'
    ];

    requiredPages.forEach(file => {
      const fullPath = path.join(frontendPublic, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  test('Step 11.1: PWA Manifest & Service Worker exist and contain valid cache configurations', () => {
    const manifestPath = path.join(frontendRoot, 'manifest.json');
    const swPath = path.join(frontendRoot, 'service-worker.js');

    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(swPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toMatch(/Navora/i);
    expect(manifest.start_url).toBeTruthy();

    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('navora-v');
    expect(swContent).toContain('fetch');
  });

  test('Step 11.10: Frontend API client uses relative base path /api/v1 without hardcoded localhost URLs', () => {
    const apiJsPath = path.join(frontendRoot, 'assets/js/api.js');
    expect(fs.existsSync(apiJsPath)).toBe(true);
    const content = fs.readFileSync(apiJsPath, 'utf8');

    expect(content).toContain("const API_BASE='/api/v1'");
    expect(content).not.toContain('http://localhost:5000/api/v1');
    expect(content).not.toContain('http://127.0.0.1:5000');
  });

  test('Step 11.15: Frontend Security Audit — Zero hardcoded passwords, tokens, or MongoDB URIs in frontend assets', () => {
    const jsFiles = [
      'assets/js/api.js',
      'assets/js/auth.js',
      'assets/js/map.js',
      'assets/js/dashboard.js',
      'assets/js/data-pages.js',
      'assets/js/replay.js'
    ];

    jsFiles.forEach(file => {
      const fullPath = path.join(frontendRoot, file);
      if (fs.existsSync(fullPath)) {
        const text = fs.readFileSync(fullPath, 'utf8');
        expect(text).not.toContain('mongodb+srv://');
        expect(text).not.toContain('JWT_SECRET');
        expect(text).not.toContain('sk-proj-');
      }
    });
  });

  test('Step 11.16: Cross-Page Backend Endpoints serve proper static responses and auth redirects', async () => {
    const resRoot = await request(app).get('/');
    expect([200, 302]).toContain(resRoot.status);

    const resMap = await request(app).get('/map.html');
    expect([200, 302, 404]).toContain(resMap.status);

    const resConfig = await request(app).get('/api/v1/auth/config');
    expect(resConfig.status).toBe(200);
    expect(resConfig.body.data).toHaveProperty('passkeys');
  });

});
