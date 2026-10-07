/* ---------- 다국어 (i18n) ---------- */
const I18N = window.BTALK_I18N || { defaultLanguage: 'ko', languages: [{ code: 'ko', label: '한국어' }], fonts: {}, strings: { ko: {} } };
const SUPPORTED = I18N.languages.map(language => language.code);
const STORAGE_KEY = 'btalk-lang';
const langSelect = document.querySelector('#lang-select');
let currentLanguage = I18N.defaultLanguage;

function normalizeLanguage(value) {
  if (!value) return null;
  const code = String(value).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(code) ? code : null;
}

function detectLanguage() {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
  const fromUrl = normalizeLanguage(new URLSearchParams(location.search).get('lang'));
  if (fromUrl) return fromUrl;
  const fromStorage = normalizeLanguage(stored);
  if (fromStorage) return fromStorage;
  for (const candidate of navigator.languages || [navigator.language]) {
    const match = normalizeLanguage(candidate);
    if (match) return match;
  }
  return I18N.defaultLanguage;
}

function t(key) {
  const dict = I18N.strings[currentLanguage] || {};
  const fallback = I18N.strings[I18N.defaultLanguage] || {};
  return dict[key] ?? fallback[key] ?? '';
}

function ensureFont(language) {
  const href = I18N.fonts[language];
  if (!href || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function setMeta(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute('content', value);
}

function applyLanguage(language, { persist = true } = {}) {
  currentLanguage = normalizeLanguage(language) || I18N.defaultLanguage;
  document.documentElement.lang = currentLanguage;
  ensureFont(currentLanguage);

  document.title = t('meta.title');
  setMeta('meta[name="description"]', t('meta.description'));
  setMeta('meta[property="og:title"]', t('meta.title'));
  setMeta('meta[property="og:description"]', t('meta.ogDescription'));

  document.querySelectorAll('[data-i18n]').forEach(element => {
    const value = t(element.dataset.i18n);
    if (value) element.textContent = value;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(element => {
    const value = t(element.dataset.i18nHtml);
    if (value) element.innerHTML = value; // 사전은 사이트가 직접 제공하는 신뢰된 문구입니다.
  });
  document.querySelectorAll('[data-i18n-attr]').forEach(element => {
    element.dataset.i18nAttr.split(';').forEach(pair => {
      const [attribute, key] = pair.split(':').map(part => part.trim());
      const value = t(key);
      if (attribute && value) element.setAttribute(attribute, value);
    });
  });

  if (langSelect) langSelect.value = currentLanguage;
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, currentLanguage); } catch {}
    const url = new URL(location.href);
    if (currentLanguage === I18N.defaultLanguage) url.searchParams.delete('lang');
    else url.searchParams.set('lang', currentLanguage);
    history.replaceState(history.state, '', url);
  }
  document.dispatchEvent(new CustomEvent('btalk:languagechange', { detail: { language: currentLanguage } }));
}

if (langSelect) {
  langSelect.addEventListener('change', () => applyLanguage(langSelect.value));
}

/* ---------- 모바일 메뉴 ---------- */
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function syncMenuLabel() {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-label', expanded ? t('menu.close') : t('menu.open'));
}
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  mobileNav.hidden = true;
  syncMenuLabel();
}
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  mobileNav.hidden = expanded;
  syncMenuLabel();
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
});
const desktopViewport = window.matchMedia('(min-width: 901px)');
desktopViewport.addEventListener('change', event => { if (event.matches) closeMenu(); });

/* ---------- 영상 ---------- */
const heroVideo = document.querySelector('#hero-video');
const brandVideo = document.querySelector('#brand-video');
const filmStart = document.querySelector('#film-start');
const filmStartLabel = filmStart.querySelector('.film-start-label');
let filmEnded = false;
function syncFilmLabel() {
  filmStartLabel.textContent = filmEnded ? t('film.replay') : t('film.start');
}
filmStart.hidden = false;
filmStart.addEventListener('click', async () => {
  try { await brandVideo.play(); } catch { filmStart.hidden = false; }
});
brandVideo.addEventListener('play', () => { filmStart.hidden = true; });
brandVideo.addEventListener('ended', () => {
  filmEnded = true;
  syncFilmLabel();
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
  motionLabel.textContent = heroVideo.paused ? t('motion.play') : t('motion.pause');
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

/* 언어가 바뀌면 JS가 관리하는 문구도 함께 갱신 */
document.addEventListener('btalk:languagechange', () => {
  syncMenuLabel();
  syncFilmLabel();
  syncMotionControl();
});

/* 초기 언어 적용: URL ?lang= → 저장된 선택 → 브라우저 언어 → 한국어.
   첫 방문의 브라우저 언어 감지는 저장하지 않아, 사용자가 직접 고른 값만 기억합니다. */
const initialLanguage = detectLanguage();
let explicitChoice = false;
try { explicitChoice = Boolean(normalizeLanguage(new URLSearchParams(location.search).get('lang')) || normalizeLanguage(localStorage.getItem(STORAGE_KEY))); } catch {}
applyLanguage(initialLanguage, { persist: explicitChoice });
