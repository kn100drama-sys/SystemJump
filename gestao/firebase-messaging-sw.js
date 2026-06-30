// =====================================================
// Firebase Messaging Service Worker - /gestao
// Push Notifications confiáveis (background + fallback)
// =====================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDiWieGng5YLgjy1acq6wJyY5lHR9OWv3c",
  authDomain: "bk-jump.firebaseapp.com",
  projectId: "bk-jump",
  storageBucket: "bk-jump.firebasestorage.app",
  messagingSenderId: "703828765865",
  appId: "1:703828765865:web:e9523b47e929724e85cdb8",
  measurementId: "G-F6XVS5F5D5"
});

const messaging = firebase.messaging();

// =====================================================
// 🔥 BACKGROUND (Firebase padrão)
// =====================================================
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] FCM background:', payload);

  const title = payload.notification?.title || 'Gerente Afiliado';
  const body  = payload.notification?.body || '';

  const url = payload.data?.url || '/gestao';

  self.registration.showNotification(title, {
    body,
    icon: '/gestao/icon-192.png',
    badge: '/gestao/icon-192.png',
    data: { url }
  });
});


// =====================================================
// 🔥 FALLBACK (GARANTE PUSH MESMO SE FCM FALHAR)
// =====================================================
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};

    const title = data.notification?.title || 'Gerente Afiliado';
    const body  = data.notification?.body || '';
    const url   = data.data?.url || '/gestao';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/gestao/icon-192.png',
        badge: '/gestao/icon-192.png',
        data: { url }
      })
    );

  } catch (err) {
    console.error('[SW] Push error:', err);
  }
});


// =====================================================
// 📌 CLICK NA NOTIFICAÇÃO
// =====================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/gestao';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes('/gestao') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});


// =====================================================
// 🧠 CACHE (SEGURO - SEM QUEBRAR SW)
// =====================================================
const CACHE = 'gestao-v1';

const ASSETS = [
  '/gestao/index.html',
  '/gestao/manifest.json',
  '/gestao/icon-192.png',
  '/gestao/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
