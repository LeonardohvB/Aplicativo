/// <reference lib="webworker" />

// este é o SW que o vite-plugin-pwa vai pegar e transformar
// ele é independente do seu public/sw.js

declare const self: ServiceWorkerGlobalScope;

// 👇 o Workbox vai substituir essa linha na build
// @ts-ignore
self.__WB_MANIFEST;

/* instalar */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

/* ativar */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* opcional: deixar o fetch com o navegador */
self.addEventListener("fetch", (_event) => {
  // se quiser cache custom aqui, põe depois
});

/* opcional: se um dia quiser ouvir push direto aqui
self.addEventListener("push", (event) => {
  // ...
});
*/
