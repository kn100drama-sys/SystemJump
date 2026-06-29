importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDiWieGng5YLgjy1acq6wJyY5lHR9OWv3c",
  projectId: "bk-jump",
  messagingSenderId: "703828765865",
  appId: "1:703828765865:web:e9523b47e929724e85cdb8"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon-192.png"
  });
});