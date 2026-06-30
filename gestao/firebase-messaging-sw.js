// firebase-messaging-sw.js
// Service Worker para Firebase Cloud Messaging (push notifications em background)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDiWieGng5YLgjy1acq6wJyY5lHR9OWv3c",
  authDomain:        "bk-jump.firebaseapp.com",
  projectId:         "bk-jump",
  storageBucket:     "bk-jump.firebasestorage.app",
  messagingSenderId: "703828765865",
  appId:             "1:703828765865:web:e9523b47e929724e85cdb8",
  measurementId:     "G-F6XVS5F5D5"
});

const messaging = firebase.messaging();

// ── Notificações em BACKGROUND (app fechado / tela bloqueada) ──
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensagem em background recebida:', payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'Afiliado Manager';
  const body  = notification.body  || data.body  || '';
  const icon  = notification.icon  || './icon-192.png';

  self.registration.showNotification(title, {
    body,
    icon,
    badge: './icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false,
    data: { url: payload.data?.url || '/' }
  });
});

// Clique na notificação → abre/foca o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/gestao';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Cache básico para funcionar offline
const CACHE = 'gerente-v1';
const ASSETS = [
  '/gestao/',
  '/gestao/index.html',
  '/gestao/manifest.json'
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
