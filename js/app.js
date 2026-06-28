// ─── Config pública cacheada ──────────────────────────────────────────────────
let _publicCfgCache = null;

async function getPublicConfig(force) {
  if (_publicCfgCache && !force) return _publicCfgCache;

  try {
    const r = await fetch(
      'https://beckhend-bk.onrender.com/api/public/config?_=' + Date.now()
    );

    _publicCfgCache = await r.json();
  } catch (e) {
    console.error('Erro ao carregar config pública:', e);
    _publicCfgCache = _publicCfgCache || {};
  }

  return _publicCfgCache;
}

// Invalida cache quando admin salva configs (chamado opcionalmente)
window.invalidatePublicCfgCache = function() { _publicCfgCache = null; };

async function applyBranding() {
  const cfg = await getPublicConfig();
  const nome     = cfg.site_nome      || '';
  const suporte  = cfg.site_suporte   || '';
  const promo    = cfg.site_promo     || '';
  const logoUrl  = cfg.site_logo_url  || null;
  const favUrl   = cfg.site_favicon_url || null;

  // Atualizar nome em todos os elementos marcados
  document.querySelectorAll('.brand-name').forEach(el => { el.textContent = nome; });
  // Atualizar título do documento
  document.title = `${nome} - Gire e ganhe`;

  // ── Logo: trocar ícone/svg por imagem quando houver logo enviado ──────────
  document.querySelectorAll('.brand-logo-wrap').forEach(wrap => {
    const imgEl  = wrap.querySelector('.brand-logo-img');
    const iconEl = wrap.querySelector('.brand-logo-icon');
    const txtEl  = wrap.querySelector('.brand-name');
    if (logoUrl) {
      if (imgEl) {
        imgEl.src = logoUrl;
        imgEl.style.display = 'block';
      }
      if (iconEl) iconEl.style.display = 'none';
      if (txtEl)  txtEl.style.display  = 'none';
    } else {
      if (imgEl)  imgEl.style.display  = 'none';
      if (iconEl) iconEl.style.display = '';
      if (txtEl) { txtEl.style.display = ''; txtEl.textContent = nome; }
    }
  });

  // Favicon
  if (favUrl) {
    let link = document.querySelector('link[rel~="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = favUrl;
  }

  // Atualizar links de suporte
  document.querySelectorAll('[data-suporte-href]').forEach(el => {
    el.href = suporte || '#';
    el.style.display = suporte ? '' : 'none';
  });
  // Atualizar texto de promoção
  document.querySelectorAll('.brand-promo').forEach(el => {
    el.textContent = promo;
    el.style.display = promo ? '' : 'none';
  });
}
window.getPublicConfig = getPublicConfig;

// ─── Router SPA ───────────────────────────────────────────────────────────────
const PROTECTED = ['#painel', '#jogo'];
const PUBLIC    = ['#login', '#cadastro', '#landing', ''];

const Pages = {
  landing:  typeof renderLanding  !== 'undefined' ? renderLanding  : null,
  login:    typeof renderLogin    !== 'undefined' ? renderLogin    : null,
  cadastro: typeof renderCadastro !== 'undefined' ? renderCadastro : null,
  painel:   typeof renderPainel   !== 'undefined' ? renderPainel   : null,
  jogo:     typeof renderJogo     !== 'undefined' ? renderJogo     : null,
};

let currentPage = null;
let cleanupFn   = null;

function navigate(hash) {
  window.location.hash = hash;
}

function getHash() {
  return window.location.hash || '#landing';
}

async function route() {
  const hash     = getHash();
  const pageName = hash.replace('#', '') || 'landing';
  const pageEl   = document.getElementById(`page-${pageName}`);

  if (!pageEl) {
    navigate('#landing');
    return;
  }

  // Verificar autenticação
  const isProtected = PROTECTED.includes(hash);
  const token       = API.getToken();

  // Permitir acesso a #jogo sem token se for modo demo
  const isDemoGame = hash === '#jogo' && (() => {
    try { return JSON.parse(sessionStorage.getItem('partida_atual'))?.modo_demo === true; }
    catch { return false; }
  })();

  if (isProtected && !token && !isDemoGame) {
    navigate('#login');
    return;
  }
  if ((hash === '#login' || hash === '#cadastro') && token) {
    navigate('#painel');
    return;
  }

  // Cleanup da página anterior
  if (typeof cleanupFn === 'function') {
    cleanupFn();
    cleanupFn = null;
  }

  // Esconder todas as páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Ativar página
  pageEl.classList.add('active');
  currentPage = pageName;

  // Renderizar
  const renderer = Pages[pageName];
  if (typeof renderer === 'function') {
    cleanupFn = await renderer(pageEl) || null;
  }
  // Aplicar branding dinâmico (nome da plataforma, suporte, etc.)
  applyBranding();

  // Mostrar/ocultar link de termos fixo da landing
  var landingTermos = document.getElementById('landing-termos-link');
  if (landingTermos) landingTermos.style.display = (pageName === 'landing') ? '' : 'none';

  // Scroll ao topo
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Verificar token válido ao carregar página protegida
async function checkAuth() {
  const token = API.getToken();
  if (!token) return false;
  try {
    await API.me();
    return true;
  } catch {
    API.clearToken();
    return false;
  }
}

// Iniciar router
window.addEventListener('hashchange', () => route());
window.addEventListener('DOMContentLoaded', async () => {
  const hash = getHash();
  const isDemoGame = hash === '#jogo' && (() => {
    try { return JSON.parse(sessionStorage.getItem('partida_atual'))?.modo_demo === true; }
    catch { return false; }
  })();
  if (PROTECTED.includes(hash) && !isDemoGame) {
    showLoading();
    const ok = await checkAuth();
    hideLoading();
    if (!ok) { navigate('#login'); return; }
  }
  route();
});

// Expor navigate globalmente
window.navigate = navigate;

// ─── Modal global de Termos de Uso ────────────────────────────────────────────
window.showTermosModal = async function() {
  var cfg = await getPublicConfig();
  var termos = (cfg.site_termos || '').trim();
  var modal = document.getElementById('modal-termos-global');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-termos-global';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    modal.innerHTML =
      '<div style="background:#1a1a2e;border-radius:16px;max-width:600px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08)">' +
          '<span style="font-weight:700;font-size:16px;color:#fff">Termos de Uso</span>' +
          '<button id="close-termos-global" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:22px;cursor:pointer;line-height:1">&#x2715;</button>' +
        '</div>' +
        '<div id="termos-global-body" style="padding:20px 24px;overflow-y:auto;color:rgba(255,255,255,0.75);font-size:14px;line-height:1.7;white-space:pre-wrap"></div>' +
      '</div>';
    document.body.appendChild(modal);
    var closeModal = function() { modal.style.display = 'none'; };
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
    modal.querySelector('#close-termos-global').addEventListener('click', closeModal);
  }
  modal.querySelector('#termos-global-body').textContent = termos || 'Nenhum termo de uso configurado.';
  modal.style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('btn-termos');
  if (btn) btn.addEventListener('click', window.showTermosModal);
});
