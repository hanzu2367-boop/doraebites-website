const siteMusic = document.getElementById('site-music');

if (siteMusic) {
  const savedTime = Number(localStorage.getItem('doraebites_music_time'));

  if (Number.isFinite(savedTime) && savedTime > 0) {
    siteMusic.addEventListener('loadedmetadata', () => {
      if (savedTime < siteMusic.duration) {
        siteMusic.currentTime = savedTime;
      }
    }, { once: true });
  }

  const startMusic = () => {
    if (!siteMusic.ended && siteMusic.paused) {
      siteMusic.play().catch(() => {});
    }
  };

  const saveMusicPosition = () => {
    localStorage.setItem('doraebites_music_time', String(siteMusic.currentTime));
  };

  siteMusic.volume = 0.7;
  siteMusic.addEventListener('timeupdate', saveMusicPosition);
  window.addEventListener('pagehide', saveMusicPosition);
  siteMusic.addEventListener('canplay', startMusic);
  startMusic();

  ['click', 'keydown', 'touchstart'].forEach(eventName => {
    document.addEventListener(eventName, startMusic, { passive: true });
  });

  document.addEventListener('visibilitychange', startMusic);
  window.addEventListener('focus', startMusic);
  siteMusic.addEventListener('pause', startMusic);
  setInterval(startMusic, 1000);
}
