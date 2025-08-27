// src/lib/images.ts
export const withAvatarSize = (url: string, size = 96) =>
  `${url}${url.includes('?') ? '&' : '?'}w=${size}&h=${size}&fit=cover&quality=70`;

export const withCacheBust = (url: string, v?: string | null) =>
  v ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}` : url;
