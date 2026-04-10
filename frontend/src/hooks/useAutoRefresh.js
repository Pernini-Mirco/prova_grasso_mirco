import { useEffect, useRef } from 'react';

export default function useAutoRefresh(callback, delay = 60000, enabled = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !delay) {
      return undefined;
    }

    function runRefresh() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      callbackRef.current?.();
    }

    function handleVisibilityResume() {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        callbackRef.current?.();
      }
    }

    const intervalId = window.setInterval(runRefresh, delay);
    document.addEventListener('visibilitychange', handleVisibilityResume);
    window.addEventListener('focus', handleVisibilityResume);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityResume);
      window.removeEventListener('focus', handleVisibilityResume);
    };
  }, [delay, enabled]);
}
