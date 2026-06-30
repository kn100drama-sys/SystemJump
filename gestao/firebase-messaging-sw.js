// =====================================================
// Firebase Messaging Service Worker - /gestao
// SEM DUPLICAÇÃO (versão correta)
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
// 🔥 BACKGROUND MESSAGE (ÚNICO RESPONSÁVEL)
// =====================================================
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

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
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});


// =====================================================
// 🧠 CACHE SIMPLES (SEM BUG)
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
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE && caches.delete(k)))
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
