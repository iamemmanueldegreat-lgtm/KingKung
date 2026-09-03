import { useEffect, useState } from 'react';

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavStandalone = (navigator as any).standalone === true;
      setIsInstalled(isStandalone || isNavStandalone);
    };

    const checkDevice = () => {
      // Direct detection of iOS devices and IPadOS (including Safari)
      const userAgent = navigator.userAgent || '';
      const isIos = /iPhone|iPad|iPod/i.test(userAgent);
      
      // iPad iOS 13+ detection
      const isMacIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

      setIsIPhone(isIos || isMacIPad);
    };

    checkInstalled();
    checkDevice();

    // Check if prompt is already cached
    if ((window as any).deferredPrompt) {
      setInstallable(true);
    }

    const handler = () => {
      console.log('[PWA Hook] beforeinstallprompt-ready event received');
      setInstallable(true);
    };

    const appInstalledHandler = () => {
      console.log('[PWA Hook] appinstalled event received');
      setIsInstalled(true);
      setInstallable(false);
    };

    window.addEventListener('beforeinstallprompt-ready', handler);
    window.addEventListener('appinstalled', appInstalledHandler);

    // Keep checking display mode periodically in case user changes view
    const matchMediaObj = window.matchMedia('(display-mode: standalone)');
    const mediaHandler = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    
    if (matchMediaObj.addEventListener) {
      matchMediaObj.addEventListener('change', mediaHandler);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt-ready', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
      if (matchMediaObj.removeEventListener) {
        matchMediaObj.removeEventListener('change', mediaHandler);
      }
    };
  }, []);

  const triggerInstall = async (): Promise<boolean> => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) {
      console.warn('[PWA Hook] No deferredPrompt event is cached to trigger.');
      return false;
    }
    
    try {
      console.log('[PWA Hook] Triggering native install prompt');
      // Show the install prompt
      await promptEvent.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await promptEvent.userChoice;
      console.log(`[PWA Hook] User install choices: ${choiceResult.outcome}`);
      
      // Clear saved prompt event once completed
      (window as any).deferredPrompt = null;
      setInstallable(false);
      
      return choiceResult.outcome === 'accepted';
    } catch (err) {
      console.error('[PWA Hook] Native install flow failed', err);
      return false;
    }
  };

  return { isInstalled, installable, isIPhone, triggerInstall };
}
