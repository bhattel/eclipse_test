const inner = document.getElementById('backgroundInner');

// How much taller than the viewport we want the background content to be
// before we stop loading images. Increase if you want more coverage.
const COVER_MULTIPLIER = 1.35;

// Improved loader:
// - Merges available optimized manifests reliably
// - Creates picture/img elements for all images but only starts network
//   requests for a small priority set and for images observed near viewport
// - Keeps a concurrency limit for active downloads
async function loadSequentialUntilCovered() {
  try {
    // Helper that attempts to fetch JSON and returns null on any failure
    async function tryFetch(path) {
      try {
        const r = await fetch(path);
        if (r.ok) return await r.json();
      } catch (e) { /* ignore */ }
      return null;
    }

    // Prefer using the optimized manifest so the site always serves optimized images.
    // Fall back to any other manifest if the optimized one isn't available.
    let manifest = await tryFetch('images/optimized/manifest.json');
    if (!manifest) manifest = await tryFetch('images.optimized.json') || {};
    const files = Object.keys(manifest || {});
    console.info('[loader] optimized manifest entries:', files.length);
    if (!files.length) console.warn('[loader] No optimized manifest entries found. Check deployment.');

    const CONCURRENCY = 4; // increase concurrent loads a bit
    const PRIORITY_COUNT = 6; // first N images start immediately

    // Helpful manifest lookup that tolerates case/extension differences
    function findManifestEntry(fname) {
      if (!manifest) return null;
      if (manifest[fname]) return manifest[fname];
      const lower = fname.toLowerCase();
      if (manifest[lower]) return manifest[lower];
      // Try swapping common extensions
      const alt = fname.replace(/\.[^/.]+$/, (ext) => {
        const e = ext.toLowerCase();
        if (e === '.jpg' || e === '.jpeg') return '.png';
        if (e === '.png') return '.jpg';
        return ext;
      });
      if (manifest[alt]) return manifest[alt];
      if (manifest[alt.toLowerCase()]) return manifest[alt.toLowerCase()];
      return null;
    }

    // Queue/semaphore for concurrent downloads
    const queue = [];
    let active = 0;
    function enqueue(img, fname) {
      queue.push({ img, fname });
      processQueue();
    }
    function processQueue() {
      while (active < CONCURRENCY && queue.length) {
        const { img, fname } = queue.shift();
        active++;
        startLoad(img, fname).finally(() => { active--; processQueue(); });
      }
    }

    // Start the actual image network load
    async function startLoad(img, fname) {
      try {
        const entry = findManifestEntry(fname);
        if (entry) {
          const srcsetParts = [];
          if (entry['900']) srcsetParts.push(`${entry['900']} 900w`);
          if (entry['1600']) srcsetParts.push(`${entry['1600']} 1600w`);
          if (srcsetParts.length) {
            img.srcset = srcsetParts.join(', ');
            img.sizes = '100vw';
          }
          // Use placeholder initially (if provided) to keep layout stable
          img.src = entry['placeholder'] || srcsetParts[0]?.split(' ')[0] || ('images/' + fname);
        } else {
          img.src = 'images/' + fname;
        }

        await new Promise((resolve) => {
          img.addEventListener('load', () => {
            img.classList.remove('placeholder');
            img.classList.add('loaded');
            resolve();
          }, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      } catch (e) {
        // swallow per-image errors
      }
    }

    // IntersectionObserver to lazily start loads for offscreen images
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          observer.unobserve(img);
          enqueue(img, img.dataset.fname);
        }
      });
    }, { root: null, rootMargin: '800px', threshold: 0.01 });

    // Create picture/img placeholders and wire up priority vs lazy loading
    files.forEach((fname, i) => {
      const picture = document.createElement('picture');
      const img = document.createElement('img');
      img.decoding = 'async';
      img.alt = '';
      img.style.width = '100%';
      img.style.display = 'block';
      img.classList.add('placeholder');
      img.dataset.fname = fname;

      // Keep browser hints but don't force loads for non-priority images
      img.loading = (i < PRIORITY_COUNT) ? 'eager' : 'lazy';

      // If there's a small placeholder available in the manifest, use it to reduce jank
      const entry = findManifestEntry(fname);
      if (entry && entry['placeholder']) img.src = entry['placeholder'];
      else img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

      picture.appendChild(img);
      inner.appendChild(picture);

      if (i < PRIORITY_COUNT) {
        enqueue(img, fname);
      } else {
        observer.observe(img);
      }
    });

  } catch (e) {
    console.error('Failed to load images.json or images', e);
  }
}

function isCovered() {
  // Determine document height (the total scrollable page height) and stop when
  // the background content height meets or exceeds that (times COVER_MULTIPLIER).
  // This ensures background images fill to the bottom of the page as you scroll.
  const docEl = document.documentElement || {};
  const body = document.body || {};
  const docHeight = Math.max(docEl.scrollHeight || 0, body.scrollHeight || 0, window.innerHeight);
  return inner.scrollHeight >= docHeight * COVER_MULTIPLIER;
}

// Start loading sequence
loadSequentialUntilCovered();

// Parallax scrolling for the background-inner (keeps previous behavior)
const box = document.querySelector('.box');
document.addEventListener('scroll', () => {
  const scrollY = window.scrollY || window.pageYOffset;
  const boxHeight = box.offsetHeight;
  const viewportHeight = window.innerHeight;
  const maxTranslate = Math.max(0, boxHeight - viewportHeight);
  const translateY = -Math.min(scrollY * 0.5, maxTranslate);
  inner.style.transform = `translateY(${translateY}px)`;
});

// -----------------------------
// Video initialization (HLS + preview->full swap)
// -----------------------------
async function initVideo() {
  const video = document.getElementById('mainVideo');
  if (!video) return;

  // Sound hint overlay wiring: show a prompt until user unmutes/interacts
  try {
    const soundHint = document.getElementById('soundHint');
    const unmuteBtn = document.getElementById('unmuteBtn');

    function hideHint() {
      if (!soundHint) return;
      soundHint.setAttribute('aria-hidden', 'true');
    }

    function doUnmute() {
      try { video.muted = false; video.volume = 1.0; } catch (e) {}
      video.play().catch(()=>{});
      hideHint();
    }

    if (soundHint) {
      // Show hint when video is muted or autoplay muted
      const shouldShow = video.muted || video.volume === 0;
      if (shouldShow) soundHint.setAttribute('aria-hidden', 'false');
      else hideHint();

      if (unmuteBtn) unmuteBtn.addEventListener('click', (e) => { e.stopPropagation(); doUnmute(); });

        // Do NOT unmute when clicking the overlay background; only the button should
        // handle unmute. (Previously the overlay click triggered unmute everywhere.)

      // If playback starts with audio, hide hint
      video.addEventListener('play', () => { if (!video.muted) hideHint(); });
    }
  } catch (e) { /* ignore overlay wiring errors */ }

  // If a loader exposed `window.__hlsReady`, wait for it so Hls is available
  if (window.__hlsReady && typeof window.__hlsReady.then === 'function') {
    console.info('[hls] waiting for loader to provide Hls...');
    try { await window.__hlsReady; console.info('[hls] Hls is available'); } catch (e) { console.warn('[hls] loader failed', e); }
  }

  // Try using HLS first when hls.js is available. Don't rely on a HEAD request
  // because some hosts block HEAD or Pages may behave differently.
  const hlsUrl = 'video/playlist.m3u8';
  try {
    if (window.Hls) {
      console.info('[hls] initializing hls.js');
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          console.info('[hls] manifest parsed; starting playback');
          video.play().catch(()=>{});
        });
        hls.on(Hls.Events.ERROR, function(evt, data) { console.warn('[hls] error', evt, data); });
        return;
      }
      console.warn('[hls] Hls is present but not supported in this environment');
    }

    // If the browser can play HLS natively (Safari), set the src directly
    if (video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', function() { video.play().catch(()=>{}); });
      return;
    }
  } catch (e) {
    // ignore HLS initialization errors and continue to MP4 fallback
  }

  // If no HLS, try preview->full swap. Use data attributes for links if available.
  const previewUrl = video.dataset.preview || null;
  const fullUrl = video.dataset.full || null;

  // If neither provided, the page already contains a source and will play that (fallback)
  if (!previewUrl || !fullUrl) {
    video.play().catch(()=>{});
    return;
  }

  // Set preview as current source
  const sourceEl = video.querySelector('source') || document.createElement('source');
  sourceEl.src = previewUrl;
  sourceEl.type = 'video/mp4';
  if (!video.contains(sourceEl)) video.appendChild(sourceEl);
  video.load();
  video.play().catch(()=>{});

  // Preload full URL metadata in a hidden element
  const preloader = document.createElement('video');
  preloader.src = fullUrl;
  preloader.preload = 'metadata';
  preloader.muted = true;
  preloader.playsInline = true;

  function swapToFull() {
    try {
      const current = video.currentTime || 0;
      sourceEl.src = fullUrl;
      video.load();
      video.currentTime = current;
      video.play().catch(()=>{});
    } catch (e) {
      sourceEl.src = fullUrl;
      video.load();
      video.play().catch(()=>{});
    }
    preloader.removeEventListener('loadedmetadata', swapToFull);
    preloader.removeEventListener('canplaythrough', swapToFull);
  }

  preloader.addEventListener('loadedmetadata', swapToFull, { once: true });
  preloader.addEventListener('canplaythrough', swapToFull, { once: true });

  // Fallback: force swap after 8s
  setTimeout(() => {
    if (video && video.currentTime < 3) swapToFull();
  }, 8000);
}

// init video once DOM is loaded
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initVideo);
else initVideo();
