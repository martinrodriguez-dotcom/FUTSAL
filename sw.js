const CACHE_NAME = 'futsal-app-cache-v2.2'; // <--- ¡AQUÍ ESTÁ EL CAMBIO!
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/icon-192x192.png',
    '/icon-512x512.png',
    'https://cdn.tailwindcss.com',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// Evento Install: se cachean los assets principales
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache abierto y assets nuevos cacheados (v2)');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting(); // Forzar al nuevo SW a activarse
});

// Evento Activate: se limpia caché vieja
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                // Borra todos los cachés que NO se llamen como el nuevo
                cacheNames.filter(name => name !== CACHE_NAME).map(name => {
                    console.log('Borrando caché viejo:', name);
                    return caches.delete(name);
                })
            );
        })
    );
    self.clients.claim(); // Tomar control de todas las pestañas abiertas
});

// Evento Fetch: estrategia "Cache First"
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si está en caché, se devuelve
                if (response) {
                    return response;
                }
                
                // Si no, se busca en la red
                return fetch(event.request).then(
                    networkResponse => {
                        // (Opcional) Guardar en caché la nueva respuesta
                        // Solo cacheamos respuestas GET exitosas
                        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    }
                ).catch(() => {
                    // Manejo de error si falla la red (puedes mostrar una página offline)
                });
            })
    );
});
