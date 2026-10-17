// Small JSON values in localStorage; every access is wrapped because storage can be unavailable.

export const loadStored = (key, fallback) => {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

export const saveStored = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stored values are a convenience; ignore unavailable storage.
  }
};

const prefsKey = 'mdit.ui';

export const loadPrefs = () => loadStored(prefsKey, {});

export const savePrefs = (prefs) => saveStored(prefsKey, prefs);
