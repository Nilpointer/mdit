// Small least-recently-used cache for render results (highlighted code, Mermaid SVGs), so
// re-rendering on every keystroke reuses unchanged blocks without growing for the whole session.
export const createLruCache = (limit) => {
  const entries = new Map();

  return {
    get(key) {
      if (!entries.has(key)) {
        return undefined;
      }
      const value = entries.get(key);
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      if (entries.size > limit) {
        entries.delete(entries.keys().next().value);
      }
    },
  };
};
