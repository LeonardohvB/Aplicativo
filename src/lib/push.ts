import { supabase, isSupabaseConfigured } from './supabase'

type PushSubscriptionInfo = {
  endpoint: string
  keys?: { p256dh?: string; auth?: string }
}

/**
 * Solicita permissão e registra o subscription no PushManager.
 * Salva (upsert) no Supabase na tabela 'push_subscriptions'.
 * Chame este método após o usuário estar autenticado.
 */
export async function enableWebPush(opts: {
  userId: string
  tenantId: string
}): Promise<PushSubscription | null> {
  // Suporte mínimo
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    console.warn('Push não suportado neste navegador.')
    return null
  }

  // Permissão
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.warn('Permissão de notificação negada.')
    return null
  }

  // Garantir que há service worker registrado (em DEV pode estar desativado)
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) {
    console.warn('Service worker não registrado (em DEV você pode ter desativado o SW).')
    return null
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    console.error('Faltando VITE_VAPID_PUBLIC_KEY nas envs.')
    return null
  }

  // Criar assinatura
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  // Extrair dados serializáveis
  const info: PushSubscriptionInfo =
    typeof (sub as any).toJSON === 'function'
      ? (sub as any).toJSON()
      : (JSON.parse(JSON.stringify(sub)) as PushSubscriptionInfo)

  // Persistir no Supabase apenas se o client estiver configurado
  if (supabase && isSupabaseConfigured) {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: opts.userId,
        tenant_id: opts.tenantId,
        endpoint: info.endpoint,
        p256dh: info.keys?.p256dh,
        auth: info.keys?.auth,
      })
    if (error) console.error('Erro salvando subscription:', error)
  } else {
    console.warn('Supabase não configurado; pulando persistência da assinatura de push.')
  }

  return sub
}

/** Cancela a assinatura do Push deste dispositivo e (opcional) remove do banco. */
export async function disableWebPush(deleteFromDB = true) {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return

    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    const endpoint = sub.endpoint
    await sub.unsubscribe()

    // remove do Supabase se o client estiver configurado
    if (deleteFromDB && supabase && isSupabaseConfigured) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
  } catch (e) {
    console.warn('Falha ao desativar Web Push', e)
  }
}

/** Converte VAPID public key base64 para Uint8Array */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
