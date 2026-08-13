/* global clients */
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'ระบบตรวจวัดระดับน้ำนาเกลือ'
  const body = data.body ?? 'มีการแจ้งเตือนใหม่'
  const status = data.status ?? 'safe'

  const iconMap = {
    safe: '/pwa-icon.svg',
    warning: '/pwa-icon.svg',
    danger: '/pwa-icon.svg',
    critical: '/pwa-icon.svg',
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: iconMap[status] ?? '/pwa-icon.svg',
      badge: '/pwa-icon.svg',
      tag: 'aquasense-alert',
      renotify: true,
      vibrate: status === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
      data: { url: '/', status },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
