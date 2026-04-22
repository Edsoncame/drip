// Notification sound — chime agradable generado con Web Audio API

export function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Chime: dos tonos cortos ascendentes (C5, E5)
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    });
  } catch {}
}

export function sendBrowserNotification(title: string, body: string) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icon.png",
        badge: "/icon.png",
        silent: true, // usamos nuestro propio sonido
      });
      playNotificationSound();
    }
  } catch {}
}
