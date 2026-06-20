// ─── Domain Lock: bloqueia execução em domínios não autorizados ───────────────
;(function() {
const allowed = [
  'https://helijump.netlify.app',
  'https://bk-jogue.app',
  'localhost',
  '127.0.0.1',
  'meusite.com',
  'www.meusite.com',
  '192.168.100.64'
];

  if (!allowed.includes(location.hostname)) {
    document.documentElement.innerHTML =
      '<body style="background:#000;color:#f00;font-family:monospace;padding:40px">' +
      '<h1>Acesso Negado</h1><p>Este sistema não está autorizado a funcionar neste domínio.</p>' +
      '</body>';
    throw new Error('Unauthorized domain');
  }
})();

// ─── API Client ───────────────────────────────────────────────────────────────
const API = (() => {
  let BASE = 'https://beckhend-bk.onrender.com/api';

  function getToken() {
    return localStorage.getItem('hw_token');
  }
  function setToken(t) {
    if (t) localStorage.setItem('hw_token', t);
    else   localStorage.removeItem('hw_token');
  }
  function clearToken() {
    localStorage.removeItem('hw_token');
    localStorage.removeItem('hw_user');
  }

  function saveUser(u) {
    if (u) localStorage.setItem('hw_user', JSON.stringify(u));
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('hw_user') || 'null'); } catch { return null; }
  }

  async function request(method, path, body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (!token) {
        clearToken();
        window.location.hash = '#login';
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      if (auth) {
        // Só redireciona para login em chamadas autenticadas (não no próprio login)
        clearToken();
        window.location.hash = '#login';
      }
      throw new Error(data.error || 'Sessão expirada.');
    }
    if (!res.ok) {
      throw new Error(data.error || `Erro ${res.status}`);
    }
    return data;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  async function login(telefone, senha) {
    const data = await request('POST', '/auth/login', { telefone, senha }, false);
    setToken(data.token);
    saveUser(data.user);
    return data;
  }

  async function register(payload) {
    const data = await request('POST', '/auth/register', payload, false);
    setToken(data.token);
    saveUser(data.user);
    return data;
  }

  async function me() {
    const data = await request('GET', '/auth/me');
    saveUser(data.user);
    return data;
  }



  // ── User ─────────────────────────────────────────────────────────────────
  async function dashboard() {
    return request('GET', '/user/dashboard');
  }
  async function salvarPix(chave_pix) {
    return request('PUT', '/user/pix', { chave_pix });
  }
  async function alterarSenha(senha_atual, senha_nova) {
    return request('PUT', '/user/senha', {
      senha_atual,
      nova_senha: senha_nova
    });
  }

  // ── Game ─────────────────────────────────────────────────────────────────
  async function gameConfigs() {
    return request('GET', '/game/configs');
  }
  async function iniciarPartida(valor_entrada, multiplicador_meta) {
    return request('POST', '/game/iniciar', {
      valor_entrada,
      multiplicador_meta
    });
  }
  async function finalizarPartida(partida_id, plataformas_passadas, resgatou) {
    return request('POST', '/game/finalizar', { partida_id, plataformas_passadas, resgatou });
  }

  // ── Financeiro ───────────────────────────────────────────────────────────
  async function depositoInfo() {
    return request('GET', '/user/deposito-info');
  }
  async function deposito(valor, cpf, aceitar_bonus_deposito = true) {
    return request('POST', '/financeiro/deposito', { valor, cpf, aceitar_bonus_deposito });
  }
  async function depositoStatus(txid) {
    return request('GET', `/financeiro/deposito/status/${txid}`);
  }
  async function saque(valor, chave_pix, cpf) {
    return request('POST', '/financeiro/saque', { valor, chave_pix, cpf });
  }
  async function saqueAfiliado(valor, chave_pix, cpf) {
    return request('POST', '/financeiro/saque-afiliado', { valor, chave_pix, cpf });
  }
  async function historico(pagina = 1, limite = 20) {
    return request('GET', `/financeiro/historico?pagina=${pagina}&limite=${limite}`);
  }
  async function meusSaques() {
    return request('GET', '/financeiro/meus-saques');
  }

  // ── Indicação ────────────────────────────────────────────────────────────
  async function indicacaoInfo() {
    return request('GET', '/indicacao/info');
  }
  async function redeInfo() {
    return request('GET', '/indicacao/rede');
  }

  // ── Suporte ──────────────────────────────────────────────────────────────
function openSupport() {
  if (window.$crisp) {
    $crisp.push(["do", "chat:open"]);
  } else {
    alert("Suporte ainda não carregado.");
  }
}

  // ── Cupons ───────────────────────────────────────────────────────────────
  async function validarCupom(codigo) {
    return request('POST', '/cupons/validar', { codigo });
  }
  async function resgatarCupom(codigo) {
    return request('POST', '/cupons/resgatar', { codigo });
  }

  return {
    getToken, setToken, clearToken, getUser, saveUser,
    login, register, me,
    dashboard, salvarPix, alterarSenha, depositoInfo,
    gameConfigs, iniciarPartida, finalizarPartida,
    deposito, depositoStatus, saque, saqueAfiliado, historico, meusSaques,
    indicacaoInfo, redeInfo, openSupport,
    validarCupom, resgatarCupom,
  };
})();
