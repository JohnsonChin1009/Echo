"use client";

import { useState, useEffect } from 'react';
import { FaAndroid, FaApple, FaDownload, FaX } from "react-icons/fa6";

type Platform = 'android' | 'ios' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
}

const CLOSE_COUNT_KEY = 'pwa-install-prompt-close-count';

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [closeCount, setCloseCount] = useState<number>(0);

  useEffect(() => {
    const detectPlatform = (): Platform => {
      const ua = navigator.userAgent.toLowerCase();
      if (/android/.test(ua)) return 'android';
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      return 'desktop';
    };

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    const isMobile = ['android', 'ios'].includes(detectedPlatform);
    const storedCloseCount = parseInt(localStorage.getItem(CLOSE_COUNT_KEY) || '0', 10);
    setCloseCount(storedCloseCount);

    const shouldShowPrompt = !isStandalone && isMobile && storedCloseCount < 2;

    if (shouldShowPrompt) {
      setShowPrompt(true);
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleClose = () => {
    const newCloseCount = closeCount + 1;
    setCloseCount(newCloseCount);
    localStorage.setItem(CLOSE_COUNT_KEY, newCloseCount.toString());
    setShowPrompt(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
        localStorage.setItem(CLOSE_COUNT_KEY, '2'); // Ensure prompt doesn't show again after installation
      }
    }
  };

  if (!showPrompt) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1 right-1 bg-gradient-to-br from-[#e0f7fa] to-[#e6e6fa] rounded-3xl shadow-xl p-4 mx-auto w-[370px] max-w-[95%] z-50">
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 p-2.5"
        >
          <FaX size={14} />
        </button>
        <div className="flex items-center mb-3 text-gray-700 space-x-2">
          {platform === 'android' ? (
            <FaAndroid size={24} />
          ) : (
            <FaApple size={24} />
          )}
          <h3 className="text-lg font-semibold text-gray-800">
            Install our app
          </h3>
        </div>
        <p className="text-sm text-black mb-4">
          Add our app to your home screen for quick and easy access.
        </p>
        {platform === 'android' ? (
          <button
            onClick={handleInstall}
            className="w-full bg-white font-bold py-2 px-4 rounded flex items-center justify-center"
          >
            <FaDownload size={20} className="mr-2" />
            Install
          </button>
        ) : (
          <div className="text-sm text-gray-600">
            <p className="mb-2">To install, tap the share icon</p>
            <p>Then select &quot;Add to Home Screen&quot;</p>
          </div>
        )}
      </div>
    </>
  );
}