const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '메뉴 열기');
  mobileNav.hidden = true;
}
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? '메뉴 열기' : '메뉴 닫기');
  mobileNav.hidden = expanded;
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
});
const desktopViewport = window.matchMedia('(min-width: 761px)');
desktopViewport.addEventListener('change', event => { if (event.matches) closeMenu(); });

const heroVideo = document.querySelector('#hero-video');
const brandVideo = document.querySelector('#brand-video');
const filmStart = document.querySelector('#film-start');
filmStart.hidden = false;
filmStart.addEventListener('click', async () => {
  try { await brandVideo.play(); } catch { filmStart.hidden = false; }
});
brandVideo.addEventListener('play', () => { filmStart.hidden = true; });
brandVideo.addEventListener('ended', () => {
  filmStart.querySelector('.film-start-label').textContent = '영상 다시 보기';
  filmStart.hidden = false;
});
const motionControl = document.querySelector('#motion-control');
const motionLabel = motionControl.querySelector('.motion-label');
const motionIcon = motionControl.querySelector('.motion-icon');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionRequested = !reducedMotion.matches && !navigator.connection?.saveData;
let heroVisible = true;
let heroFailed = false;
let filmWasPlaying = false;

function syncMotionControl() {
  motionLabel.textContent = heroVideo.paused ? '배경 영상 재생' : '배경 영상 멈춤';
  motionIcon.textContent = heroVideo.paused ? '▷' : 'Ⅱ';
}

async function updateHeroPlayback() {
  if (heroFailed) return;
  if (!motionRequested || !heroVisible || document.hidden || !brandVideo.paused) {
    heroVideo.pause();
    return;
  }
  if (!heroVideo.getAttribute('src')) heroVideo.src = heroVideo.dataset.src;
  try { await heroVideo.play(); } catch { syncMotionControl(); }
}

motionControl.hidden = false;
motionControl.addEventListener('click', () => {
  motionRequested = heroVideo.paused;
  updateHeroPlayback();
});
heroVideo.addEventListener('play', syncMotionControl);
heroVideo.addEventListener('pause', syncMotionControl);
heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-ready'));
heroVideo.addEventListener('error', () => {
  heroFailed = true;
  heroVideo.classList.remove('is-ready');
  motionControl.hidden = true;
});
reducedMotion.addEventListener('change', () => {
  motionRequested = !reducedMotion.matches && !navigator.connection?.saveData;
  updateHeroPlayback();
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    updateHeroPlayback();
  }, { threshold: 0.05 }).observe(document.querySelector('.hero'));
} else { updateHeroPlayback(); }
brandVideo.addEventListener('play', updateHeroPlayback);
brandVideo.addEventListener('pause', updateHeroPlayback);
brandVideo.addEventListener('ended', updateHeroPlayback);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    filmWasPlaying = !brandVideo.paused;
    brandVideo.pause();
  } else if (filmWasPlaying) {
    filmWasPlaying = false;
    brandVideo.play().catch(() => {});
  }
  updateHeroPlayback();
});
