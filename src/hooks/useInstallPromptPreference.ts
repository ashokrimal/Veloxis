import {useCallback, useEffect, useState} from 'react';

const SESSION_DISMISS_KEY = 'veloxis_install_prompt_dismissed_session_v1';
const PERMANENT_HIDE_KEY = 'veloxis_install_prompt_never_v1';

function detectMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaData = (
    navigator as unknown as {
      userAgentData?: {mobile?: boolean};
    }
  ).userAgentData;
  if (typeof uaData?.mobile === 'boolean') {
    return uaData.mobile;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    ua,
  );
}

function readSessionDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function readPermanentHide(): boolean {
  try {
    return localStorage.getItem(PERMANENT_HIDE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useInstallPromptPreference() {
  const [isMobileBrowser, setIsMobileBrowser] = useState<boolean>(detectMobileBrowser);
  const [sessionDismissed, setSessionDismissed] = useState<boolean>(
    readSessionDismissed,
  );
  const [permanentlyHidden, setPermanentlyHidden] = useState<boolean>(
    readPermanentHide,
  );

  useEffect(() => {
    setIsMobileBrowser(detectMobileBrowser());
  }, []);

  const dismissForSession = useCallback(() => {
    setSessionDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  }, []);

  const hidePermanently = useCallback(() => {
    setPermanentlyHidden(true);
    setSessionDismissed(true);
    try {
      localStorage.setItem(PERMANENT_HIDE_KEY, 'true');
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  }, []);

  const reEnablePrompts = useCallback(() => {
    setPermanentlyHidden(false);
    setSessionDismissed(false);
    try {
      localStorage.removeItem(PERMANENT_HIDE_KEY);
      sessionStorage.removeItem(SESSION_DISMISS_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    isMobileBrowser,
    sessionDismissed,
    permanentlyHidden,
    canAutoPrompt: !sessionDismissed && !permanentlyHidden,
    dismissForSession,
    hidePermanently,
    reEnablePrompts,
  };
}
