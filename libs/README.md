Place `hls.min.js` here for client-side HLS playback.

Why this file exists
- `script.js` will look for `window.Hls` and use it to play `video/playlist.m3u8`.
- You asked not to rely on external CDNs, so this repo should include the library file.

How to get `hls.min.js`
1. Download the latest `hls.min.js` from the hls.js releases page:
   - https://github.com/video-dev/hls.js/releases
   - Download the `dist/hls.min.js` file for the release you want.
2. Place the downloaded file at `libs/hls.min.js` in this repository.
3. Commit and push. GitHub Pages will then serve it from `/libs/hls.min.js`.

Notes
- If you prefer to vendor the file automatically, you can add it with your package manager or CI pipeline.
- If you choose to use a CDN instead, remove `libs/hls.min.js` and add the CDN script tag to `index.html`.
