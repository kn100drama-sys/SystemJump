(function () {
  var state = { loaded: false, pixelId: '', ready: false };

  function uuid() {
    return 'fp_' + Date.now() + '_' + Math.random().toString(16).slice(2, 10);
  }

  function ensurePixel(pixelId) {
    if (!pixelId || state.loaded) return;
    state.loaded = true;
    state.pixelId = pixelId;

    if (!window.fbq) {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
    }

    try {
      window.fbq('init', pixelId);
      state.ready = true;
    } catch (e) {
      console.warn('[Pixel] Erro ao inicializar:', e);
    }
  }

  function track(eventName, data, eventId) {
    if (typeof window.fbq !== 'function') {
      // Se não estiver pronto mas tivermos o ID, tentamos inicializar (fallback)
      if (state.pixelId && !state.ready) {
         ensurePixel(state.pixelId);
      }
      if (typeof window.fbq !== 'function') return null;
    }

    var eid = eventId || uuid();
    try {
      var params = data || {};
      window.fbq('track', eventName, params, { eventID: eid });
      console.log('[Pixel] Evento:', eventName, params, 'ID:', eid);
      return eid;
    } catch (e) {
      console.warn('[Pixel] Erro ao trackear ' + eventName + ':', e);
      return null;
    }
  }

  function pageView() {
    track('PageView', { 
      page_path: location.pathname + location.hash,
      page_location: location.href
    });
  }

  window.FacebookPixel = {
    init: ensurePixel,
    track: track,
    pageView: pageView,
    viewContent: function (data) { return track('ViewContent', data || {}); },
    initiateCheckout: function (data) { return track('InitiateCheckout', data || {}); },
    completeRegistration: function (data, eventId) { return track('CompleteRegistration', data || {}, eventId); },
    purchase: function (data, eventId) { return track('Purchase', data || {}, eventId); },
    isReady: function () { return !!state.ready; },
    getPixelId: function () { return state.pixelId || ''; }
  };

  fetch('/api/public/config?_=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg || cfg.facebook_pixel_ativo !== true && cfg.facebook_pixel_ativo !== '1') return;
      if (!cfg.facebook_pixel_id) return;
      
      ensurePixel(cfg.facebook_pixel_id);
      // pageView() removido daqui para ser chamado pelo Router (app.js) ou manualmente
    })
    .catch(function () {});

  // Listener para SPA (hash changes)
  window.addEventListener('hashchange', function() {
    if (state.ready) pageView();
  });
})();
