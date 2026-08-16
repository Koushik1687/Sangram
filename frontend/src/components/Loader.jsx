import React, { useEffect } from 'react';

/* Loading screen. Hidden once the window fires 'load' (content is ready),
   but capped at MAX_WAIT so a stalled image/request can never pin the
   full-screen overlay — a slow resource was making the site feel stuck. */
const MAX_WAIT = 3500;

export default function Loader() {
  useEffect(() => {
    const loader = document.getElementById('loader');
    if (!loader) return;

    let hideTimer;
    const hide = () => {
      clearTimeout(hideTimer);
      loader.classList.add('hidden');
    };
    const handleLoad = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, 500);
    };

    hideTimer = setTimeout(hide, MAX_WAIT);
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => {
        window.removeEventListener('load', handleLoad);
        clearTimeout(hideTimer);
      };
    }
    return () => clearTimeout(hideTimer);
  }, []);

  return (
    <div id="loader">
      <div className="loader-wheel"></div>
      <div className="loader-text">Aligning planets...</div>
    </div>
  );
}
