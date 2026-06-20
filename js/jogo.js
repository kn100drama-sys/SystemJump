// ── Página do Jogo — mecânica de resgate livre ────────────────────────────────
// Nova mecânica:
//  • Plataformas infinitas — o jogo não para por número de plataformas
//  • Cada plataforma = valor_por_plataforma (fixo, configurado no admin)
//  • Meta = valor_entrada × multiplicador — indica quando o botão de resgate aparece
//  • Jogador ESCOLHE quando parar clicando em "Resgatar"
//  • Se morrer sem resgatar: perde o valor de entrada

let temaAtual = "padrao"; // Definido globalmente para ser acessível por todas as funções

async function carregarConfig() {
  try {
    const res = await fetch("/api/public/config");
    const data = await res.json();
    temaAtual = data.theme || "padrao";
  } catch (e) {
    temaAtual = "padrao";
  }
}

async function renderJogo(container) {
  // Carregar configuração de tema antes de renderizar
  await carregarConfig();

  // Ler dificuldade ANTES de montar o HTML para que o iframe já nasça com src correto
  let _difInicial = 'normal';
  try {
    const _p = JSON.parse(sessionStorage.getItem('partida_atual'));
    if (_p && _p.dificuldade) _difInicial = _p.dificuldade;
    // Landing "jogar grátis" grava só partida mínima (sem demo_killer_*). Buscar config pública
    // ANTES do iframe — assim gameEvents e o 1º frame do jogo veem sliders do admin (evita race).
    if (_p && String(_p.partida_id) === 'demo') {
      try {
        const _r = await fetch('/api/game/public-demo-config?_=' + Date.now(), {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (_r.ok) {
          const _cfg = await _r.json();
          sessionStorage.setItem(
            'partida_atual',
            JSON.stringify({ ..._p, ..._cfg })
          );
        }
      } catch (_err) { /* mantém partida mínima */ }
    }
  } catch (_e) {}

  container.innerHTML = `
    <div id="jogo-wrapper" style="position:relative;width:100%;height:100vh;overflow:hidden;background:#0a0a1a">

      <!-- iframe do jogo Three.js (src já inclui ?dif= para funcionar no mobile) -->
    <iframe
      id="game-iframe"
      src="jogo/index.html"
      style="width:100%;height:100%;border:none;display:block"
      allow="accelerometer; autoplay"
      title="Game">
    </iframe>

      <!-- HUD overlay -->
      <div id="hud-container" style="
        position:fixed;top:0;left:0;right:0;z-index:1000;
        background:linear-gradient(180deg,rgba(0,0,0,.85) 0%,transparent 100%);
        padding:12px 16px 20px;
        display:none;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">

          <!-- Aposta e meta -->
          <div style="display:flex;flex-direction:column;gap:2px">
            <div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px">Aposta</div>
            <div id="hud-aposta" style="font-size:16px;font-weight:800;color:#fff">R$ 0,00</div>
          </div>

          <!-- Progresso central -->
          <div style="flex:1;max-width:360px;text-align:center">
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:5px">
              <div id="hud-acumulado" style="font-size:20px;font-weight:800;color:#00C97A;transition:all .2s">R$ 0,00</div>
              <div style="font-size:12px;color:rgba(255,255,255,.4)">/</div>
              <div id="hud-meta" style="font-size:14px;color:rgba(255,255,255,.6)">R$ 0,00</div>
            </div>
            <!-- Barra de progresso -->
            <div style="background:rgba(255,255,255,.1);border-radius:50px;height:8px;overflow:visible;position:relative">
              <div id="hud-barra" style="height:100%;border-radius:50px;width:0%;transition:width .35s ease,background .6s ease,box-shadow .6s ease;position:relative"></div>
            </div>
            <div id="hud-plat" style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px">0 plataformas • R$0,00/plat</div>
          </div>

          <!-- Meta e botão sair -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px">Meta</div>
            <div id="hud-meta-label" style="font-size:16px;font-weight:800;color:#FFD700">R$ 0,00</div>
            <button onclick="voltarPainel()" style="
              background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);
              border-radius:8px;padding:4px 10px;color:rgba(255,255,255,.5);
              font-size:11px;cursor:pointer;font-family:inherit
            ">Sair</button>
          </div>
        </div>
      </div>

      <!-- Botão RESGATAR — aparece ao atingir a meta -->
      <button id="btn-resgatar" onclick="executarResgate()" style="
        display:none;
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:linear-gradient(135deg,#FFD700,#FFA500);
        color:#000;font-size:18px;font-weight:800;
        padding:16px 36px;border-radius:50px;border:none;
        cursor:pointer;z-index:2000;
        box-shadow:0 0 30px rgba(255,215,0,.6),0 4px 20px rgba(0,0,0,.4);
        font-family:inherit;white-space:nowrap;
        animation:pulseGold 1.2s ease-in-out infinite;
      ">
        🏆 RESGATAR R$ 0,00
      </button>
      <div id="btn-resgatar-hint" style="
        display:none;position:fixed;bottom:56px;left:50%;transform:translateX(-50%);
        font-size:11px;color:rgba(255,215,0,.75);text-align:center;
        white-space:nowrap;z-index:2000;
      ">Continue jogando para ganhar mais!</div>

      <!-- Tela de carregamento — tema roxo / marca (sem assets Copa) -->
      <div id="tela-loading" style="
        position:fixed;inset:0;z-index:3000;
        background:radial-gradient(ellipse at 50% 40%, #1a0040 0%, #0a0a1a 70%);
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;
        overflow:hidden;
      ">
        <div style="position:absolute;width:340px;height:340px;border-radius:50%;
          background:radial-gradient(circle,rgba(100,0,255,0.18) 0%,transparent 70%);
          top:50%;left:50%;transform:translate(-50%,-60%);pointer-events:none"></div>
        <div style="position:absolute;width:220px;height:220px;border-radius:50%;
          background:radial-gradient(circle,rgba(255,107,157,0.13) 0%,transparent 70%);
          top:50%;left:50%;transform:translate(-30%,-30%);pointer-events:none"></div>

        <div style="position:relative;width:88px;height:88px;margin-bottom:32px">
          <svg viewBox="0 0 88 88" style="position:absolute;inset:0;width:100%;height:100%;animation:ldRingSpin 1.4s linear infinite">
            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,107,157,0.18)" stroke-width="4"/>
            <circle cx="44" cy="44" r="38" fill="none" stroke="url(#ldGrad1)" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="60 180" stroke-dashoffset="0"/>
            <defs>
              <linearGradient id="ldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FF6B9D"/>
                <stop offset="100%" stop-color="#a855f7"/>
              </linearGradient>
            </defs>
          </svg>
          <svg viewBox="0 0 88 88" style="position:absolute;inset:0;width:100%;height:100%;animation:ldRingSpin 0.9s linear infinite reverse">
            <circle cx="44" cy="44" r="26" fill="none" stroke="rgba(168,85,247,0.15)" stroke-width="3"/>
            <circle cx="44" cy="44" r="26" fill="none" stroke="url(#ldGrad2)" stroke-width="3"
              stroke-linecap="round" stroke-dasharray="30 120" stroke-dashoffset="0"/>
            <defs>
              <linearGradient id="ldGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#a855f7"/>
                <stop offset="100%" stop-color="#00C97A"/>
              </linearGradient>
            </defs>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 32 32" fill="none" width="32" height="32" style="animation:ldPulse 1.8s ease-in-out infinite">
              <circle cx="16" cy="16" r="14" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
              <path d="M16 2a17 17 0 0 1 5 14 17 17 0 0 1-5 14 17 17 0 0 1-5-14A17 17 0 0 1 16 2z"
                stroke="#FF6B9D" stroke-width="2" stroke-linecap="round"/>
              <line x1="2" y1="16" x2="30" y2="16" stroke="#FF6B9D" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.3px;margin-bottom:10px;text-align:center">
          Preparando partida...
        </div>

        <div id="loading-msg" style="font-size:14px;color:rgba(255,255,255,0.42);font-weight:500;text-align:center;margin-bottom:36px">
          Aguarde
        </div>

        <div style="width:180px;height:3px;background:rgba(255,255,255,0.08);border-radius:50px;overflow:hidden">
          <div style="height:100%;border-radius:50px;
            background:linear-gradient(90deg,#FF6B9D,#a855f7,#00C97A);
            background-size:200% 100%;
            animation:ldShimmer 1.5s ease-in-out infinite">
          </div>
        </div>

        <style>
          @keyframes ldRingSpin { to { transform: rotate(360deg); } }
          @keyframes ldPulse {
            0%,100% { opacity:1; transform:scale(1); }
            50%      { opacity:0.6; transform:scale(0.88); }
          }
          @keyframes ldShimmer {
            0%   { background-position: 200% 0; width:0%; }
            50%  { width:100%; }
            100% { background-position: -200% 0; width:0%; }
          }
        </style>
      </div>

      <!-- Tela de resultado -->
      <div id="tela-resultado" style="
        position:fixed;inset:0;z-index:3000;display:none;
        align-items:center;justify-content:center;
        background:rgba(0,0,0,.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        padding:20px;
      ">
        <div id="resultado-card" style="
          background:linear-gradient(160deg,#13001f 0%,#1e003a 100%);
          border-radius:28px;padding:0;
          max-width:360px;width:100%;text-align:center;
          border:1.5px solid transparent;
          box-shadow:0 32px 80px rgba(0,0,0,.7);
          overflow:hidden;
          animation:resCardIn .45s cubic-bezier(.34,1.56,.64,1) both;
        ">
          <!-- Faixa topo colorida -->
          <div id="resultado-topo" style="padding:28px 28px 20px;position:relative;">
            <!-- Ícone com glow -->
            <div id="resultado-icon-wrap" style="
              width:72px;height:72px;border-radius:50%;margin:0 auto 14px;
              display:flex;align-items:center;justify-content:center;
              font-size:36px;
            "></div>
            <div id="resultado-titulo" style="font-size:22px;font-weight:900;letter-spacing:.5px;margin-bottom:6px"></div>
            <div id="resultado-subtitulo" style="font-size:13px;color:rgba(255,255,255,.55);line-height:1.5"></div>
          </div>

          <!-- Valor principal -->
          <div id="resultado-valor-wrap" style="
            margin:0 20px 16px;border-radius:16px;padding:16px 20px;
          ">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;opacity:.7;margin-bottom:6px" id="resultado-valor-label"></div>
            <div id="resultado-valor" style="font-size:38px;font-weight:900;line-height:1"></div>
          </div>

          <!-- Info -->
          <div style="padding:0 24px 20px">
            <div id="resultado-plat" style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:6px"></div>
            <div id="resultado-saldo" style="
              font-size:13px;font-weight:600;color:rgba(255,255,255,.65);
              background:rgba(255,255,255,.06);border-radius:10px;
              padding:8px 14px;margin-top:10px;
            "></div>
          </div>

          <!-- Botões -->
          <div style="padding:0 20px 24px;display:flex;gap:10px">
            <button onclick="jogarNovamente()" style="
              flex:1;background:linear-gradient(135deg,#FF6B9D,#c026d3);
              color:#fff;border:none;border-radius:50px;
              padding:14px 0;font-size:14px;font-weight:800;
              cursor:pointer;font-family:inherit;letter-spacing:.3px;
              box-shadow:0 4px 20px rgba(255,107,157,.4);
              display:flex;align-items:center;justify-content:center;gap:8px;
              transition:transform .15s,box-shadow .15s;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Jogar Novamente
            </button>
            <button onclick="voltarPainel()" style="
              background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.15);
              color:rgba(255,255,255,.75);border-radius:50px;
              padding:14px 20px;font-size:14px;font-weight:700;
              cursor:pointer;font-family:inherit;
              display:flex;align-items:center;justify-content:center;gap:6px;
              transition:background .15s;
            " onmouseover="this.style.background='rgba(255,255,255,.14)'" onmouseout="this.style.background='rgba(255,255,255,.08)'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Painel
            </button>
          </div>
        </div>
      </div>

      <!-- Confetti canvas -->
      <canvas id="confetti-canvas" style="position:fixed;inset:0;z-index:3500;pointer-events:none;display:none"></canvas>

    </div>

    <style>
      @keyframes pulseGold {
        0%,100% { transform:translateX(-50%) scale(1);    box-shadow:0 0 30px rgba(255,215,0,.6),0 4px 20px rgba(0,0,0,.4); }
        50%      { transform:translateX(-50%) scale(1.04); box-shadow:0 0 50px rgba(255,215,0,.9),0 4px 24px rgba(0,0,0,.5); }
      }
      @keyframes jogoPopIn {
        from { transform:translateX(-50%) scale(.5); opacity:0; }
        to   { transform:translateX(-50%) scale(1);  opacity:1; }
      }
      @keyframes resCardIn {
        from { transform:scale(.75) translateY(30px); opacity:0; }
        to   { transform:scale(1)   translateY(0);    opacity:1; }
      }
      @keyframes iconPop {
        0%   { transform:scale(0) rotate(-20deg); }
        70%  { transform:scale(1.25) rotate(5deg); }
        100% { transform:scale(1) rotate(0deg); }
      }
      @keyframes slideDown {
        from { transform:translateY(-20px); opacity:0; }
        to   { transform:translateY(0);     opacity:1; }
      }
    </style>
  `;

  // ── Expor funções globais necessária
  window.executarResgate = executarResgate;
  window.jogarNovamente  = jogarNovamente;
  window.voltarPainel    = voltarPainel;

  // ── Estado da partida ─────────────────────────────────────────────────────
  let partida            = null;
  let plataformasPassadas = 0;
  let valorAcumulado      = 0;
  let metaAtingida        = false;
  let resgatou            = false;
  let partidaFinalizada   = false;

  // ── Heartbeat: rastreamento server-side de plataformas ────────────────────
  let _lastHeartbeatAt   = 0;
  let _lastHeartbeatPlat = 0;
  function _enviarHeartbeat(pid, n) {
    const agora = Date.now();
    // Enviar se: passou pelo menos 5 plataformas OU 3 segundos desde o último heartbeat
    if (n - _lastHeartbeatPlat < 5 && agora - _lastHeartbeatAt < 3000) return;
    _lastHeartbeatAt   = agora;
    _lastHeartbeatPlat = n;
    fetch('/api/game/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (API.getToken() || '')
      },
      body: JSON.stringify({ partida_id: pid, plataformas: n })
    }).catch(() => {});
  }

  // ── Carregar dados da partida do sessionStorage ───────────────────────────
  try {
    partida = JSON.parse(sessionStorage.getItem('partida_atual'));
  } catch {}

  if (!partida?.partida_id) {
    document.getElementById('loading-msg').textContent = 'Nenhuma partida ativa. Voltando...';
    setTimeout(voltarPainel, 2000);
    return;
  }

  const {
    partida_id,
    valor_entrada,
    valor_meta,
    valor_por_plataforma,
    dificuldade,
    modo_demo,
    is_demo,
  } = partida;

  const IS_CONTA_DEMO = !!is_demo;
  // Conta demo (is_demo) OU modo_demo no painel — não usar ?? : modo_demo=false ignoraria is_demo.
  const IS_DEMO = !!is_demo || !!modo_demo;
  // Só o teste grátis da landing usa partida_id literal 'demo'. Partida via API (id numérico) = sempre vitória/derrota normais,
  // mesmo com modo_demo=1 e demo=0 no banco (ex.: contas gerente).
  const SESSAO_TESTE_GRATIS = String(partida.partida_id) === 'demo';
  const dificuladadeAtiva = dificuldade || 'normal';

  // API envia demo_killer_* só para quem qualifica + toggle admin; repassar ao iframe mesmo sem coluna demo=1 (ex.: só modo_demo)
  const partidaDemoRulesOn =
    partida.demo_killer_use_custom === 1 ||
    partida.demo_killer_use_custom === true ||
    String(partida.demo_killer_use_custom ?? '').trim() === '1';
  const passDemoRulesToIframe = IS_DEMO || partidaDemoRulesOn;
  // Conta demo, Modo demo no admin, ou sliders custom da API — iframe aplica Jogo/Demo
  const adminDemoGame = IS_DEMO || partidaDemoRulesOn;

  // ── Configurar gameEvents (comunicação com o iframe) ──────────────────────
  window.gameEvents = {
    onPlataformaPassada:  null,
    onMorreu:             null,
    onMetaAtingida:       null, // não usado mais, mas mantido por compatibilidade
    metaPlataformas:      999999,   // infinito — jogo nunca para por plataformas
    partida_id:           partida_id,
    valorPorPlataforma:   parseFloat(valor_por_plataforma),
    valorMeta:            parseFloat(valor_meta),
    dificuldade:          dificuladadeAtiva,
    is_demo:              IS_CONTA_DEMO,
    admin_demo_game:      adminDemoGame,
    modo_demo:            SESSAO_TESTE_GRATIS, // só landing / jogar grátis — conta demo logada usa vitória/derrota normais
    partidaAtiva:         false,
    _plataformasPassadas: 0,
    // Regras demo do admin: /api/game/iniciar ou /api/game/public-demo-config na landing
    demo_killer_use_custom:           passDemoRulesToIframe ? (partida.demo_killer_use_custom || '') : '',
    demo_killer_segment_chance_pct:   passDemoRulesToIframe ? (partida.demo_killer_segment_chance_pct ?? '') : '',
    demo_killer_max_per_platform:     passDemoRulesToIframe ? (partida.demo_killer_max_per_platform ?? '0') : '0',
    demo_killer_guarantee_every_n:    passDemoRulesToIframe ? (partida.demo_killer_guarantee_every_n ?? '0') : '0',
    demo_gravity_percent:             passDemoRulesToIframe ? (partida.demo_gravity_percent ?? '100') : '100',
  };

  // ── Ativar a partida após o iframe carregar ───────────────────────────────
  // Só pode rodar UMA vez por visita à página: o fallback de 3s usa partidaAtiva;
  // depois de morrer partidaAtiva fica false — sem esse guard, ~3s após a morte
  // ativarPartida rodaria de novo, zerando partidaFinalizada e quebrando o fluxo
  // (duplo finalizar / painel com "Erro ao carregar dados").
  let ativacaoPartidaFeita = false;
  function ativarPartida() {
    if (ativacaoPartidaFeita) return;
    ativacaoPartidaFeita = true;

    plataformasPassadas = 0;
    valorAcumulado      = 0;
    metaAtingida        = false;
    resgatou            = false;
    partidaFinalizada   = false;

    window.gameEvents._plataformasPassadas = 0;
    window.gameEvents.partidaAtiva         = true;

    // Resetar temperatura do fundo ao iniciar partida
    const _heatIframe = () => document.getElementById('game-iframe')?.contentWindow;
    _heatIframe()?.setHeatPct?.(0);

    // Callback: plataforma passada
    window.gameEvents.onPlataformaPassada = (n) => {
      plataformasPassadas = n;
      valorAcumulado      = parseFloat((n * parseFloat(valor_por_plataforma)).toFixed(2));
      atualizarHUD(n, valorAcumulado);

      // Heartbeat: informar servidor do progresso real para validação server-side
      if (!SESSAO_TESTE_GRATIS) {
        try { _enviarHeartbeat(partida_id, n); } catch (_) {}
      }

      // Atualizar temperatura do fundo conforme % acumulada
      const pct = Math.min(100, (valorAcumulado / parseFloat(valor_meta)) * 100);
      _heatIframe()?.setHeatPct?.(pct);

      if (!metaAtingida && valorAcumulado >= parseFloat(valor_meta)) {
        metaAtingida = true;
        _heatIframe()?.setHeatPct?.(100);
        mostrarBotaoResgatar(valorAcumulado);
      } else if (metaAtingida) {
        atualizarBotaoResgatar(valorAcumulado);
      }
    };

    // Callback: morreu sem resgatar
    window.gameEvents.onMorreu = async () => {
      if (resgatou || partidaFinalizada) return;
      partidaFinalizada              = true;
      window.gameEvents.partivaAtiva = false;
      esconderHUD();
      esconderBotaoResgatar();
      _pararMusicaCopa();

      if (SESSAO_TESTE_GRATIS) {
        mostrarModalDemo(valorAcumulado, false);
        return;
      }

      try {
        const res = await API.finalizarPartida(partida_id, plataformasPassadas, false);
        mostrarDerrota(res);
      } catch (e) {
        mostrarDerrota({ saldo_novo: null, valor_ganho_ou_perdido: parseFloat(valor_entrada) });
      }
    };

    // Atualizar HUD
    document.getElementById('hud-container').style.display = 'block';
    document.getElementById('hud-aposta').textContent   = formatMoney(valor_entrada);
    document.getElementById('hud-meta-label').textContent = formatMoney(valor_meta);
    document.getElementById('hud-meta').textContent     = formatMoney(valor_meta);
    atualizarHUD(0, 0);

    // Esconder loading
    document.getElementById('tela-loading').style.display = 'none';
  }

  // Aguardar iframe carregar, depois ativar
  const iframe = document.getElementById('game-iframe');
  iframe.addEventListener('load', () => setTimeout(ativarPartida, 400));
  // Fallback: se iframe já carregou
  setTimeout(() => {
    if (!window.gameEvents.partidaAtiva) ativarPartida();
  }, 3000);

  // ── HUD ──────────────────────────────────────────────────────────────────
  // ── Estilos da barra injetados uma vez ───────────────────────────────────
  (function injetarEstilosBarra() {
    if (document.getElementById('hud-barra-styles')) return;
    const s = document.createElement('style');
    s.id = 'hud-barra-styles';
    s.textContent = `
      @keyframes barraPulse {
        0%,100% { opacity: 1; filter: brightness(1); }
        50%      { opacity: .82; filter: brightness(1.35); }
      }
      @keyframes barraGold {
        0%,100% { box-shadow: 0 0 8px 2px rgba(255,215,0,.55), 0 0 18px 4px rgba(255,165,0,.35); filter: brightness(1); }
        50%      { box-shadow: 0 0 18px 6px rgba(255,215,0,.85), 0 0 36px 10px rgba(255,165,0,.55); filter: brightness(1.45); }
      }
      #hud-barra.pulso   { animation: barraPulse 1.1s ease-in-out infinite; }
      #hud-barra.ouro    { animation: barraGold  0.75s ease-in-out infinite; }
    `;
    document.head.appendChild(s);
  })();

  function atualizarHUD(n, acumulado) {
    const meta = parseFloat(valor_meta);
    const vpp  = parseFloat(valor_por_plataforma);
    const pct  = Math.min((acumulado / meta) * 100, 100);

    document.getElementById('hud-acumulado').textContent = formatMoney(acumulado);
    document.getElementById('hud-plat').textContent =
      `${n} plataforma${n !== 1 ? 's' : ''} • +${formatMoney(vpp)}/plat`;

    const barra     = document.getElementById('hud-barra');
    const acumEl    = document.getElementById('hud-acumulado');

    // ── Cor da barra conforme progresso (interpolação de cor) ────────────
    let bg, shadow, acumColor;

    if (pct >= 100) {
      // Dourado — meta atingida
      bg         = 'linear-gradient(90deg,#FFD700,#FFA500,#FFD700)';
      shadow     = '0 0 14px 4px rgba(255,215,0,.7), 0 0 28px 8px rgba(255,165,0,.45)';
      acumColor  = '#FFD700';
      barra.classList.remove('pulso');
      barra.classList.add('ouro');
    } else if (pct >= 75) {
      // Vermelho quente — tensão máxima
      bg         = 'linear-gradient(90deg,#ef4444,#f97316)';
      shadow     = `0 0 10px 3px rgba(239,68,68,${0.4 + (pct - 75) / 100})`;
      acumColor  = '#f97316';
      barra.classList.remove('ouro');
      barra.classList.add('pulso');
    } else if (pct >= 50) {
      // Laranja — aquecendo
      const t    = (pct - 50) / 25;
      bg         = `linear-gradient(90deg,#f97316,${lerpColor('#f97316','#ef4444',t)})`;
      shadow     = `0 0 8px 2px rgba(249,115,22,${0.25 + t * 0.2})`;
      acumColor  = '#f97316';
      barra.classList.remove('pulso','ouro');
    } else if (pct >= 25) {
      // Verde → amarelo → laranja
      const t    = (pct - 25) / 25;
      bg         = `linear-gradient(90deg,${lerpColor('#22c55e','#f97316',t)},${lerpColor('#16a34a','#ea580c',t)})`;
      shadow     = `0 0 6px 1px rgba(34,197,94,${0.2 + t * 0.15})`;
      acumColor  = lerpColor('#22c55e', '#f97316', t);
      barra.classList.remove('pulso','ouro');
    } else {
      // Azul frio — início tranquilo
      const t    = pct / 25;
      bg         = `linear-gradient(90deg,#3b82f6,${lerpColor('#3b82f6','#22c55e',t)})`;
      shadow     = '0 0 4px 1px rgba(59,130,246,0.2)';
      acumColor  = lerpColor('#3b82f6', '#22c55e', t);
      barra.classList.remove('pulso','ouro');
    }

    barra.style.width      = pct + '%';
    barra.style.background = bg;
    barra.style.boxShadow  = shadow;
    acumEl.style.color     = acumColor;
    acumEl.style.textShadow = pct >= 75 ? `0 0 12px ${acumColor}88` : 'none';
  }

  // Interpolação linear entre duas cores hex
  function lerpColor(a, b, t) {
    const ah = parseInt(a.slice(1),16), bh = parseInt(b.slice(1),16);
    const ar = ah>>16, ag = (ah>>8)&0xff, ab = ah&0xff;
    const br = bh>>16, bg2 = (bh>>8)&0xff, bb = bh&0xff;
    const r = Math.round(ar + (br-ar)*t);
    const g = Math.round(ag + (bg2-ag)*t);
    const bl= Math.round(ab + (bb-ab)*t);
    return `#${((r<<16)|(g<<8)|bl).toString(16).padStart(6,'0')}`;
  }

  function esconderHUD() {
    document.getElementById('hud-container').style.display = 'none';
  }

  // ── Botão Resgatar ────────────────────────────────────────────────────────
  function mostrarBotaoResgatar(valor) {
    const btn  = document.getElementById('btn-resgatar');
    const hint = document.getElementById('btn-resgatar-hint');
    btn.textContent = `🏆 RESGATAR ${formatMoney(valor)}`;
    btn.style.display = 'block';
    btn.style.animation = 'jogoPopIn .4s ease, pulseGold 1.2s ease-in-out .4s infinite';
    hint.style.display = 'block';
    // Borda dourada no HUD
    document.getElementById('hud-container').style.borderBottom = '2px solid rgba(255,215,0,.5)';
  }

  function atualizarBotaoResgatar(valor) {
    const btn = document.getElementById('btn-resgatar');
    btn.textContent = `🏆 RESGATAR ${formatMoney(valor)}`;
  }

  function esconderBotaoResgatar() {
    document.getElementById('btn-resgatar').style.display = 'none';
    document.getElementById('btn-resgatar-hint').style.display = 'none';
  }

  // ── Ação de resgate ───────────────────────────────────────────────────────
  async function executarResgate() {
    if (resgatou || partidaFinalizada) return;
    if (valorAcumulado <= 0) {
      alert('Você ainda não acumulou nenhum valor! Continue jogando.');
      return;
    }
    resgatou            = true;
    partidaFinalizada   = true;
    window.gameEvents.partidaAtiva = false;
    esconderBotaoResgatar();
    esconderHUD();

    // Para música Copa e toca vitória
    _pararMusicaCopa();
    try {
      const gIframe = document.getElementById('game-iframe');
      gIframe?.contentWindow?._gameMusic?.playVictory?.();
    } catch (_) {}

    if (SESSAO_TESTE_GRATIS) {
      mostrarModalDemo(valorAcumulado, true);
      return;
    }

    const btn = document.getElementById('btn-resgatar');
    btn.textContent = '⏳ Resgatando...';
    btn.style.display = 'block';
    btn.style.animation = 'none';
    btn.style.background = 'rgba(255,215,0,.3)';

    try {
      const res = await API.finalizarPartida(partida_id, plataformasPassadas, true);
      btn.style.display = 'none';
      mostrarVitoria(res);
    } catch (e) {
      btn.style.display = 'none';
      mostrarVitoria({
        saldo_novo: null,
        valor_gan_ou_perdido: valorAcumulado,
        plataformas_passadas: plataformasPassadas,
      });
    }
  }

  // ── Telas de resultado ────────────────────────────────────────────────────
  function mostrarVitoria(res) {
    const v = parseFloat(res.valor_ganho_ou_perdido || 0);
    const copa = temaAtual === "copa";
    const pascoa = temaAtual === "pascoa";

    document.getElementById('resultado-topo').style.background =
      copa ? 'linear-gradient(160deg,rgba(255,215,0,.18) 0%,rgba(0,156,59,.10) 100%)' :
      pascoa ? 'linear-gradient(160deg,rgba(52,211,153,.2) 0%,rgba(244,114,182,.12) 100%)' :
      'linear-gradient(160deg,rgba(0,201,122,.15) 0%,transparent 100%)';

    const iconWrap = document.getElementById('resultado-icon-wrap');
    iconWrap.style.background =
      copa ? 'linear-gradient(135deg,#FFD700,#FFA000)' :
      pascoa ? 'linear-gradient(135deg,#34d399,#10b981,#a78bfa)' :
      'linear-gradient(135deg,#00C97A,#00A362)';
    iconWrap.style.boxShadow =
      copa ? '0 0 40px rgba(255,215,0,.4)' :
      pascoa ? '0 0 40px rgba(52,211,153,.4)' :
      '0 0 40px rgba(0,201,122,.3)';
    iconWrap.innerHTML = copa ? '⚽' : pascoa ? '🥚' : '🏆';
    iconWrap.style.animation = 'iconPop .6s cubic-bezier(.34,1.56,.64,1) both';

    const titulo = document.getElementById('resultado-titulo');
    titulo.textContent = copa ? 'GOOOOL!' : pascoa ? 'FELIZ PÁSCOA!' : 'VITÓRIA!';
    titulo.style.color = copa ? '#FFD700' : pascoa ? '#6ee7b7' : '#00C97A';

    document.getElementById('resultado-subtitulo').textContent = 'Resgate realizado com sucesso!';

    const valorWrap = document.getElementById('resultado-valor-wrap');
    valorWrap.style.background =
      copa ? 'linear-gradient(135deg,rgba(255,215,0,.18),rgba(0,156,59,.10))' :
      pascoa ? 'linear-gradient(135deg,rgba(52,211,153,.18),rgba(167,139,250,.1))' :
      'rgba(0,201,122,.1)';
    valorWrap.style.border =
      copa ? '1px solid rgba(255,215,0,.35)' :
      pascoa ? '1px solid rgba(52,211,153,.32)' :
      '1px solid rgba(0,201,122,.2)';

    document.getElementById('resultado-valor-label').textContent = 'VALOR RECEBIDO';
    document.getElementById('resultado-valor-label').style.color = copa ? '#FFD700' : pascoa ? '#6ee7b7' : '#00C97A';
    document.getElementById('resultado-valor').textContent = `+ ${formatMoney(v)}`;
    document.getElementById('resultado-valor').style.color = copa ? '#FFD700' : pascoa ? '#6ee7b7' : '#00C97A';

    document.getElementById('resultado-plat').textContent =
      `Você passou ${plataformasPassadas} plataforma${plataformasPassadas !== 1 ? 's' : ''}`;

    const saldoEl = document.getElementById('resultado-saldo');
    saldoEl.textContent = res.saldo_novo != null ? `Novo saldo: ${formatMoney(res.saldo_novo)}` : '';
    saldoEl.style.display = res.saldo_novo != null ? '' : 'none';

    document.getElementById('tela-resultado').style.display = 'flex';
    dispararConfetti();

    if (copa) _estilizarBotoesResultado('vitoria', 'copa');
    else if (pascoa) _estilizarBotoesResultado('vitoria', 'pascoa');
    else _estilizarBotoesResultado('vitoria', 'padrao');
  }

  function mostrarDerrota(res) {
    const perdido = parseFloat(res.valor_ganho_ou_perdido || valor_entrada);
    const copa = temaAtual === "copa";
    const pascoa = temaAtual === "pascoa";

    document.getElementById('resultado-topo').style.background = 'linear-gradient(160deg,rgba(239,68,68,.15) 0%,transparent 100%)';

    const iconWrap = document.getElementById('resultado-icon-wrap');
    iconWrap.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
    iconWrap.style.boxShadow = '0 0 40px rgba(239,68,68,.3)';
    iconWrap.innerHTML = '💀';
    iconWrap.style.animation = 'iconPop .6s cubic-bezier(.34,1.56,.64,1) both';

    const titulo = document.getElementById('resultado-titulo');
    titulo.textContent = 'FIM DE JOGO';
    titulo.style.color = '#ef4444';

    document.getElementById('resultado-subtitulo').textContent = 'Não foi desta vez. Tente novamente!';

    const valorWrap = document.getElementById('resultado-valor-wrap');
    valorWrap.style.background = 'rgba(239,68,68,.1)';
    valorWrap.style.border = '1px solid rgba(239,68,68,.2)';

    document.getElementById('resultado-valor-label').textContent = 'VALOR PERDIDO';
    document.getElementById('resultado-valor-label').style.color = '#f87171';
    document.getElementById('resultado-valor').textContent = `- ${formatMoney(perdido)}`;
    document.getElementById('resultado-valor').style.color = '#f87171';

    document.getElementById('resultado-plat').textContent =
      `Você passou ${plataformasPassadas} plataforma${plataformasPassadas !== 1 ? 's' : ''}`;

    const saldoEl = document.getElementById('resultado-saldo');
    saldoEl.textContent = res.saldo_novo != null ? `Saldo restante: ${formatMoney(res.saldo_novo)}` : '';
    saldoEl.style.display = res.saldo_novo != null ? '' : 'none';

    document.getElementById('tela-resultado').style.display = 'flex';
    if (copa) _estilizarBotoesResultado('derrota', 'copa');
    else if (pascoa) _estilizarBotoesResultado('derrota', 'pascoa');
    else _estilizarBotoesResultado('derrota', 'padrao');
  }

  function _estilizarBotoesResultado(tipo, tema) {
    const btnJogar = document.querySelector('button[onclick="jogarNovamente()"]');
    if (!btnJogar) return;

    if (tema === 'copa') {
      btnJogar.style.background = 'linear-gradient(135deg,#009C3B,#00782D)';
      btnJogar.style.boxShadow = '0 4px 20px rgba(0,156,59,.4)';
    } else if (tema === 'pascoa') {
      btnJogar.style.background = 'linear-gradient(135deg,#059669,#10b981,#34d399)';
      btnJogar.style.boxShadow = '0 4px 20px rgba(16,185,129,.4)';
    } else {
      btnJogar.style.background = 'linear-gradient(135deg,#FF6B9D,#c026d3)';
      btnJogar.style.boxShadow = '0 4px 20px rgba(255,107,157,.4)';
    }
  }

  // ── Música Copa ───────────────────────────────────────────────────────────
  function _pararMusicaCopa() {
    try {
      const gIframe = document.getElementById('game-iframe');
      gIframe?.contentWindow?._gameMusic?.stopCopaTheme?.();
    } catch (_) {}
  }

  // ── Ações dos botões de resultado ─────────────────────────────────────────
  function jogarNovamente() {
    if (SESSAO_TESTE_GRATIS) {
      // Re-inicia a demo sem sair
      sessionStorage.setItem('partida_atual', JSON.stringify({
        partida_id: 'demo', valor_entrada: 5, valor_meta: 20,
        valor_por_plataforma: 1, dificuldade: 'super_facil', modo_demo: true,
      }));
      window.location.hash = '#jogo';
      window.location.reload();
      return;
    }
    sessionStorage.removeItem('partida_atual');
    window.location.hash = '#painel';
  }

  function voltarPainel() {
    sessionStorage.removeItem('partida_atual');
    window.location.hash = SESSAO_TESTE_GRATIS ? '#landing' : '#painel';
  }

  // ── Modal Demo ── aparece no fim da partida demo ───────────────────────────
  function mostrarModalDemo(valorGanho, resgatou) {
    const overlay = document.getElementById('tela-resultado');
    const displayValor = valorGanho > 0 ? valorGanho : parseFloat(valor_meta);
    const copa = temaAtual === "copa";
    const pascoa = temaAtual === "pascoa";

    const trophySvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
            </svg>`;

    let cardBg, cardBorder, cardShadow, topoBg, iconBg, iconShadow, titulo, tituloColor, subtitulo, labelValor, valorColor, valorBg, valorBorder, ctaTexto, btnBg, btnShadow, btnShadowHover, btnLabel, iconInner;

    if (copa) {
      cardBg = 'linear-gradient(170deg,#0a1628 0%,#0d2010 60%,#0a1628 100%)';
      cardBorder = '1.5px solid rgba(255,215,0,.55)';
      cardShadow = '0 32px 80px rgba(0,0,0,.8), 0 0 80px rgba(255,215,0,.2), 0 0 120px rgba(0,156,59,.1)';
      topoBg = 'linear-gradient(160deg,rgba(255,215,0,.18) 0%,rgba(0,156,59,.10) 100%)';
      iconBg = 'linear-gradient(135deg,#FFD700,#FFA000)';
      iconShadow = '0 0 50px rgba(255,215,0,.7)';
      titulo = '🏆 QUE CRAQUE!';
      tituloColor = '#FFD700';
      subtitulo = 'Veja quanto você <strong>marcaria</strong> de verdade:';
      labelValor = '⚽ Seu prêmio da Copa seria';
      valorColor = '#FFD700';
      valorBg = 'linear-gradient(135deg,rgba(255,215,0,.18),rgba(0,156,59,.10))';
      valorBorder = '1px solid rgba(255,215,0,.35)';
      ctaTexto = `Entre em campo de verdade! 🇧🇷<br><span style="color:#FFD700;font-weight:700">Ganhe 50% de bônus</span> no seu primeiro depósito.<br>Hora de levantar a taça!`;
      btnBg = 'linear-gradient(135deg,#009C3B,#00782D)';
      btnShadow = 'rgba(0,156,59,.55)';
      btnShadowHover = 'rgba(0,156,59,.75)';
      btnLabel = '⚽ JOGAR DE VERDADE';
      iconInner = trophySvg;
    } else if (pascoa) {
      cardBg = 'linear-gradient(170deg,#0f172a 0%,#134e4a 48%,#312e81 100%)';
      cardBorder = '1.5px solid rgba(52,211,153,.45)';
      cardShadow = '0 32px 80px rgba(0,0,0,.78), 0 0 70px rgba(52,211,153,.2), 0 0 90px rgba(244,114,182,.1)';
      topoBg = 'linear-gradient(160deg,rgba(52,211,153,.2) 0%,rgba(244,114,182,.12) 100%)';
      iconBg = 'linear-gradient(135deg,#34d399,#10b981,#a78bfa)';
      iconShadow = '0 0 48px rgba(52,211,153,.5)';
      titulo = '🐰 QUE CAÇADA!';
      tituloColor = '#6ee7b7';
      subtitulo = 'Veja quanto a <strong>cesta da Páscoa</strong> traria para você:';
      labelValor = '🌷 Seu prêmio de Páscoa seria';
      valorColor = '#6ee7b7';
      valorBg = 'linear-gradient(135deg,rgba(52,211,153,.18),rgba(167,139,250,.1))';
      valorBorder = '1px solid rgba(52,211,153,.32)';
      ctaTexto = `A primavera chamou! 🌷<br><span style="color:#a7f3d0;font-weight:700">Ganhe 50% de bônus</span> no seu primeiro depósito.<br>Hora de encher a cesta de verdade!`;
      btnBg = 'linear-gradient(135deg,#059669,#10b981,#34d399)';
      btnShadow = 'rgba(16,185,129,.52)';
      btnShadowHover = 'rgba(52,211,153,.65)';
      btnLabel = '🥚 JOGAR DE VERDADE';
      iconInner = '<span style="font-size:42px;line-height:1" aria-hidden="true">🥚</span>';
    } else {
      cardBg = 'linear-gradient(160deg,#13001f 0%,#1e003a 100%)';
      cardBorder = '1.5px solid rgba(255,215,0,.4)';
      cardShadow = '0 32px 80px rgba(0,0,0,.75), 0 0 60px rgba(255,215,0,.12)';
      topoBg = 'linear-gradient(160deg,rgba(255,180,0,.14) 0%,rgba(255,215,0,.04) 100%)';
      iconBg = 'linear-gradient(135deg,#f59e0b,#fbbf24)';
      iconShadow = '0 0 40px rgba(251,191,36,.55)';
      titulo = 'PARABÉNS!';
      tituloColor = '#fbbf24';
      subtitulo = 'Veja quanto você poderia ter ganho:';
      labelValor = 'Você poderia ter ganhado';
      valorColor = '#fbbf24';
      valorBg = 'linear-gradient(135deg,rgba(251,191,36,.14),rgba(245,158,11,.07))';
      valorBorder = '1px solid rgba(251,191,36,.28)';
      ctaTexto = `Parabéns pelo seu desempenho no teste grátis!<br><span style="color:#FF6B9D;font-weight:700">Ganhe 50% de bônus</span> no seu primeiro depósito.<br>Comece a ganhar dinheiro de verdade agora!`;
      btnBg = 'linear-gradient(135deg,#FF6B9D,#c026d3)';
      btnShadow = 'rgba(255,107,157,.50)';
      btnShadowHover = 'rgba(255,107,157,.65)';
      btnLabel = 'CRIAR CONTA GRÁTIS';
      iconInner = trophySvg;
    }

    overlay.innerHTML = `
      <div id="demo-modal" style="
        background:${cardBg};
        border:${cardBorder};
        border-radius:28px; max-width:360px; width:92%;
        text-align:center; overflow:hidden;
        box-shadow:${cardShadow};
        animation:resCardIn .45s cubic-bezier(.34,1.56,.64,1) both;
      ">

        <!-- Topo -->
        <div style="background:${topoBg}; padding:30px 28px 22px; position:relative;">
          <div style="
            width:76px;height:76px;border-radius:50%;margin:0 auto 16px;
            display:flex;align-items:center;justify-content:center;
            background:${iconBg};
            box-shadow:${iconShadow};
            animation:iconPop .55s cubic-bezier(.34,1.56,.64,1) both;
          ">
            ${iconInner}
          </div>

          <div style="font-size:24px;font-weight:900;color:${tituloColor};letter-spacing:.6px;margin-bottom:6px">
            ${titulo}
          </div>
          <div style="font-size:13px;color:rgba(255,255,255,.5);line-height:1.5">
            ${subtitulo}
          </div>
        </div>

        <!-- Valor -->
        <div style="
          margin:0 20px 16px;
          background:${valorBg};
          border:${valorBorder}; border-radius:16px;
          padding:18px 20px;
        ">
          <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:${valorColor};opacity:.75;margin-bottom:6px;text-transform:uppercase">
            ${labelValor}
          </div>
          <div style="font-size:42px;font-weight:900;color:${valorColor};line-height:1;letter-spacing:1px">
            + ${formatMoney(displayValor)}
          </div>
        </div>

        <!-- Texto CTA -->
        <div style="padding:0 24px 20px;font-size:13px;color:rgba(255,255,255,.6);line-height:1.7">
          ${ctaTexto}
        </div>

        <!-- Botão -->
        <div style="padding:0 20px 24px;display:flex;flex-direction:column;gap:10px">
          <button onclick="navigate('#cadastro')" style="
            width:100%;padding:16px;border-radius:50px;border:none;cursor:pointer;
            background:${btnBg};
            color:#fff;font-size:16px;font-weight:900;letter-spacing:.5px;
            font-family:inherit;text-transform:uppercase;
            box-shadow:0 6px 28px ${btnShadow};
            transition:transform .15s,box-shadow .15s;
            display:flex;align-items:center;justify-content:center;gap:10px;
          " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 36px ${btnShadowHover}'"
             onmouseout="this.style.transform='';this.style.boxShadow='0 6px 28px ${btnShadow}'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            ${btnLabel}
          </button>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';
    overlay.style.background = 'rgba(0,0,0,.75)';
    overlay.style.backdropFilter = 'blur(10px)';

    if (resgatou) dispararConfetti();
  }

  // ── Confetti ──────────────────────────────────────────────────────────────
  function dispararConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.style.display = 'block';
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 3,
      color: ['#FFD700','#FFA500','#FF6B9D','#00C97A','#4D9EFF'][Math.floor(Math.random() * 5)],
      speed: Math.random() * 3 + 1,
      wobble: Math.random() * 10,
    }));
    let frames = 0;
    const anim = () => {
      if (++frames > 200) { canvas.style.display = 'none'; return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speed;
        p.x += Math.sin(frames * 0.05 + p.wobble) * 1.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(anim);
    };
    anim();
  }

  // ── Helper de formatação ──────────────────────────────────────────────────
  function formatMoney(v) {
    return 'R$ ' + parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Limpeza ao sair da página ─────────────────────────────────────────────
  return function cleanup() {
    // Remove <style> tags injetadas pelo jogo para não vazar animações globais
    container.querySelectorAll('style').forEach(s => s.remove());
  };
}
