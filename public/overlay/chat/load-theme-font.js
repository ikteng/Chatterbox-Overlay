// Loads the Google Font named in this template's manifest.json, so every
// bundled theme's index.html can stay identical instead of hardcoding its
// own <link> per font.
(async () => {
  try {
    const res = await fetch('manifest.json');
    const manifest = await res.json();
    if (manifest && manifest.font) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${manifest.font}&display=swap`;
      document.head.appendChild(link);
    }
  } catch {
    // no font declared / manifest unreachable — fall back to style.css's own font-family stack
  }
})();
