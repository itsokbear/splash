interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function setupPwa(onChange: () => void) {
  const standalone = matchMedia('(display-mode: standalone)');
  let installed = standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  let prompt: InstallPrompt | null = null;
  let offline: 'preparing' | 'ready' | 'unavailable' = 'unavailable';
  let installFailed = false;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    installFailed = false;
    onChange();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    prompt = null;
    onChange();
  });
  standalone.addEventListener('change', event => { installed = event.matches; onChange(); });

  if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
    offline = 'preparing';
    const scope = new URL('./', document.baseURI);
    const workerUrl = new URL('sw.js', scope);
    const updateReady = () => {
      if (navigator.serviceWorker.controller?.scriptURL === workerUrl.href) {
        offline = 'ready';
        onChange();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', updateReady);
    const register = () => { void navigator.serviceWorker.register(workerUrl, { scope: scope.href, updateViaCache: 'none' })
      .then(registration => {
        updateReady();
        const watch = () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'redundant' && !registration.active) {
              offline = 'unavailable';
              onChange();
            }
          });
        };
        registration.addEventListener('updatefound', watch);
        watch();
      }).catch(() => { offline = 'unavailable'; onChange(); }); };
    // Let the first screen load before precaching competes for the connection.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  return {
    get installed() { return installed; },
    get canInstall() { return prompt !== null && !installed; },
    get installFailed() { return installFailed; },
    get offline() { return offline; },
    async install() {
      const request = prompt;
      if (!request) return;
      prompt = null;
      try {
        await request.prompt();
        await request.userChoice;
      } catch { installFailed = true; }
      onChange();
    },
  };
}

export function installationHelp() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return 'В Safari нажми «Поделиться» → «На экран „Домой“». Если есть переключатель «Открывать как веб-приложение», оставь его включённым.';
  if (/Android/.test(navigator.userAgent)) return 'В меню Chrome выбери «Установить приложение» или «Добавить на главный экран».';
  return 'В Chrome или Edge нажми значок установки в адресной строке. На Mac в Safari: «Файл» → «Добавить в Dock».';
}
