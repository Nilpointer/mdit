// Merges component parts into one object while keeping getters as getters.
// Object spread would call each getter once and copy its value, freezing isUtility, showEditor, commands and so on.
export const compose = (...parts) => {
  const descriptors = parts.map((part) => Object.getOwnPropertyDescriptors(part));
  return Object.defineProperties({}, Object.assign({}, ...descriptors));
};
