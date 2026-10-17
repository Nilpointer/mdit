// UI preferences in localStorage; every access is wrapped because storage can be unavailable.

const prefsKey = 'mdit.ui';

export const loadPrefs = () => {
  try {
    return JSON.parse(window.localStorage.getItem(prefsKey)) ?? {};
  } catch {
    return {};
  }
};

export const savePrefs = (prefs) => {
  try {
    window.localStorage.setItem(prefsKey, JSON.stringify(prefs));
  } catch {
    // Preferences are a convenience; ignore unavailable storage.
  }
};
