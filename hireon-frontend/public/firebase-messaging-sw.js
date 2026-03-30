// Firebase Messaging Service Worker
// Handles background push notifications when the app tab is closed or not focused.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAIK4xKoyDyUr_1plCvs-pbMgHVisyQtSg",
  authDomain: "hireon-6e1f8.firebaseapp.com",
  projectId: "hireon-6e1f8",
  storageBucket: "hireon-6e1f8.firebasestorage.app",
  messagingSenderId: "277744446068",
  appId: "1:277744446068:web:2e55885ff0e9d137f6bf21",
  measurementId: "G-NJNB9B90PP",
});

const messaging = firebase.messaging();

// Handle background messages — Firebase will show a default OS notification.
// You can customise the notification here if needed.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const { title, body, icon } = payload.notification ?? {};

  self.registration.showNotification(title ?? 'HireOn', {
    body: body ?? '',
    icon: icon ?? '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data,
  });
});
