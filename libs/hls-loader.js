// Loader for hls.js: if local `libs/hls.min.js` is empty or missing,
// this loader ensures hls.js is available by loading from CDN and
// exposes a promise `window.__hlsReady` that resolves when `window.Hls` is ready.
(function() {
  if (window.Hls) {
    window.__hlsReady = Promise.resolve(window.Hls);
    return;
  }

  window.__hlsReady = new Promise(function(resolve, reject) {
    try {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1';
      s.crossOrigin = 'anonymous';
      s.onload = function() { resolve(window.Hls); };
      s.onerror = function(err) { reject(err); };
      document.head.appendChild(s);
    } catch (e) { reject(e); }
  });
})();
