// Development fixture only. Never shipped in the extension.
(() => {
  const listeners = [];
  window.chrome ??= {};
  chrome.storage = {
    local: {
      get: async () => ({mode: localStorage.getItem('qa-mode') || 'system'}),
      set: async ({mode}) => {
        const oldValue = localStorage.getItem('qa-mode');
        localStorage.setItem('qa-mode', mode);
        listeners.forEach(fn => fn({mode:{oldValue,newValue:mode}},'local'));
      }
    },
    onChanged: {addListener(fn) {listeners.push(fn);}}
  };
  addEventListener('storage', e => {
    if(e.key === 'qa-mode') listeners.forEach(fn => fn({mode:{newValue:e.newValue}},'local'));
  });
})();
