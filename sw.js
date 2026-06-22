const CACHE = 'wealth-ledger-v2';
// Cache เฉพาะไฟล์ static ที่ไม่เปลี่ยน — HTML ไม่รวม
const STATIC = ['/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // ข้าม Apps Script API และ POST ทั้งหมด
  if (e.request.url.includes('script.google.com')) return;
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // HTML + logic.js → network-first เสมอ (ลอจิกภาษีต้องสดเสมอตอน deploy)
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  if (url.pathname.endsWith('/lib/logic.js')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // static assets → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
