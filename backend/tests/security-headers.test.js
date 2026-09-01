const request=require('supertest');
process.env.NODE_ENV='test';
const {createApp}=require('../src/app');
const app=createApp();

describe('browser security headers',()=>{
  test('HTML responses enforce a compatibility-safe Content Security Policy',async()=>{
    const r=await request(app).get('/login.html');
    expect(r.status).toBe(200);
    const csp=r.headers['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain('https://cdn.jsdelivr.net');
    expect(csp).toContain('https://unpkg.com');
    expect(csp).toContain('https://accounts.google.com');
    expect(csp).toContain('https://*.tile.openstreetmap.org');
    expect(csp).toContain('https://storage.googleapis.com');
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  test('popup auth, permissions and content-type protections remain enabled',async()=>{
    const r=await request(app).get('/login.html');
    expect(r.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['permissions-policy']).toContain('geolocation=(self)');
    expect(r.headers['permissions-policy']).toContain('microphone=()');
    expect(r.headers['permissions-policy']).toContain('bluetooth=()');
    expect(r.headers['permissions-policy']).not.toContain('camera=');
  });

  test('offline shell is served under the same security policy',async()=>{
    const r=await request(app).get('/offline.html');
    expect(r.status).toBe(200);
    expect(r.headers['content-security-policy']).toBeTruthy();
    expect(r.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });
});
