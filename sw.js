const CACHE_NAME = 'bot-term-v1';
const ASSETS = [
    '/login',
    '/dashboard.html',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
