/*!
 * LCK Tracking — snippet do navegador.
 * Cole nas páginas de venda:
 *   <script defer src="https://SEU-APP/t.js" data-base="https://SEU-APP"></script>
 *
 * Gera trck_user_id (cookie _lck), carrega gtag.js + Meta Pixel dos destinos
 * ativos (IDs vindos de /api/track-config), captura ga_client_id/ga_session_id
 * e chama /api/identify e /api/event. GA4 web vai só pela gtag; o Measurement
 * Protocol fica para a compra do webhook. O mesmo event_id é usado no Pixel do
 * navegador e no CAPI (dedup).
 */
;(function () {
  'use strict'

  if (window.lck && window.lck.__ready) return

  // ---- Descobrir a base do app (data-base ou origem do próprio script) ----
  function currentScript() {
    if (document.currentScript) return document.currentScript
    var list = document.getElementsByTagName('script')
    for (var i = list.length - 1; i >= 0; i--) {
      if ((list[i].src || '').indexOf('/t.js') !== -1) return list[i]
    }
    return null
  }
  var el = currentScript()
  var BASE = ''
  if (el) {
    BASE = el.getAttribute('data-base') || ''
    if (!BASE && el.src) {
      try {
        BASE = new URL(el.src).origin
      } catch (e) {
        BASE = ''
      }
    }
  }
  BASE = BASE.replace(/\/+$/, '')

  // ---- Utils ----
  function uid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID()
    } catch (e) {}
    return (
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0
        var v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }) +
      '-' +
      Date.now().toString(36)
    )
  }

  function getCookie(name) {
    var m = document.cookie.match(
      '(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'
    )
    return m ? decodeURIComponent(m[1]) : null
  }

  function setCookie(name, value, days) {
    var exp = new Date(Date.now() + days * 864e5).toUTCString()
    var domain = ''
    // tenta cravar no domínio raiz p/ compartilhar entre subdomínios
    var host = location.hostname
    var parts = host.split('.')
    if (parts.length > 2) domain = '; domain=.' + parts.slice(-2).join('.')
    document.cookie =
      name +
      '=' +
      encodeURIComponent(value) +
      '; expires=' +
      exp +
      '; path=/; SameSite=Lax' +
      domain
  }

  function qs(name) {
    var m = location.search.match(
      '[?&]' + name + '=([^&]*)'
    )
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null
  }

  function post(path, body) {
    try {
      var url = BASE + path
      var data = JSON.stringify(body)
      // sendBeacon quando possível (não bloqueia navegação)
      if (navigator.sendBeacon) {
        var blob = new Blob([data], { type: 'application/json' })
        if (navigator.sendBeacon(url, blob)) return Promise.resolve()
      }
      return fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: data,
        keepalive: true,
        mode: 'cors',
      }).catch(function () {})
    } catch (e) {
      return Promise.resolve()
    }
  }

  // ---- trck_user_id ----
  var UID = getCookie('_lck')
  if (!UID) {
    UID = uid()
    setCookie('_lck', UID, 365)
  }

  // ---- UTMs + referrer ----
  var utms = {
    utm_source: qs('utm_source'),
    utm_medium: qs('utm_medium'),
    utm_campaign: qs('utm_campaign'),
    utm_term: qs('utm_term'),
    utm_content: qs('utm_content'),
  }

  // ---- fbp / fbc ----
  function readFb() {
    var fbp = getCookie('_fbp')
    var fbc = getCookie('_fbc')
    if (!fbc) {
      var fbclid = qs('fbclid')
      if (fbclid) {
        fbc = 'fb.1.' + Date.now() + '.' + fbclid
        setCookie('_fbc', fbc, 90)
      }
    }
    return { fbp: fbp, fbc: fbc }
  }

  // ---- gtag: client_id + session_id ----
  function loadGtag(ids) {
    if (!ids.length) return
    window.dataLayer = window.dataLayer || []
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments)
      }
    gtag('js', new Date())
    var s = document.createElement('script')
    s.async = true
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids[0])
    document.head.appendChild(s)
    for (var i = 0; i < ids.length; i++) {
      gtag('config', ids[i])
    }
  }

  function getGaIds(firstId) {
    return new Promise(function (resolve) {
      var out = { ga_client_id: null, ga_session_id: null }
      if (!firstId || typeof window.gtag !== 'function') return resolve(out)
      var done = 0
      var finish = function () {
        done++
        if (done >= 2) resolve(out)
      }
      // timeout de segurança: gtag pode demorar a carregar
      var timer = setTimeout(function () {
        resolve(out)
      }, 2500)
      try {
        gtag('get', firstId, 'client_id', function (v) {
          out.ga_client_id = v || null
          finish()
        })
        gtag('get', firstId, 'session_id', function (v) {
          out.ga_session_id = v || null
          finish()
        })
      } catch (e) {
        clearTimeout(timer)
        resolve(out)
      }
      // quando os dois chegam antes do timeout, limpa o timer
      var orig = resolve
      resolve = function (x) {
        clearTimeout(timer)
        orig(x)
      }
    })
  }

  // ---- Meta Pixel ----
  function loadPixel(ids) {
    if (!ids.length) return
    if (!window.fbq) {
      ;(function (f, b, e, v, n, t, s) {
        if (f.fbq) return
        n = f.fbq = function () {
          n.callMethod
            ? n.callMethod.apply(n, arguments)
            : n.queue.push(arguments)
        }
        if (!f._fbq) f._fbq = n
        n.push = n
        n.loaded = !0
        n.version = '2.0'
        n.queue = []
        t = b.createElement(e)
        t.async = !0
        t.src = v
        s = b.getElementsByTagName(e)[0]
        s.parentNode.insertBefore(t, s)
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    }
    for (var i = 0; i < ids.length; i++) {
      fbq('init', ids[i])
    }
  }

  // ---- Estado interno ----
  var cfg = { pixels: [], ga4: [] }

  function identify(traits) {
    var fb = readFb()
    return getGaIds(cfg.ga4[0]).then(function (ga) {
      var body = {
        trck_user_id: UID,
        fbp: fb.fbp,
        fbc: fb.fbc,
        ga_client_id: ga.ga_client_id,
        ga_session_id: ga.ga_session_id,
        referrer: document.referrer || null,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_term: utms.utm_term,
        utm_content: utms.utm_content,
        pixel_id: cfg.pixels[0] || null,
      }
      if (traits) {
        if (traits.email) body.email = traits.email
        if (traits.phone) body.phone = traits.phone
        if (traits.name) body.name = traits.name
      }
      return post('/api/identify', body)
    })
  }

  function track(name, params) {
    params = params || {}
    var eventId = uid()
    // Meta Pixel (navegador) com eventID → dedup com o CAPI
    try {
      if (window.fbq) fbq('track', name, params, { eventID: eventId })
    } catch (e) {}
    // GA4 web pela gtag (NÃO pelo Measurement Protocol)
    try {
      if (window.gtag) gtag('event', name, params)
    } catch (e) {}
    // Servidor → CAPI (mesmo event_id)
    var body = {
      trck_user_id: UID,
      event_name: name,
      event_id: eventId,
      event_source_url: location.href,
      utm_source: utms.utm_source,
      utm_medium: utms.utm_medium,
      utm_campaign: utms.utm_campaign,
      utm_term: utms.utm_term,
      utm_content: utms.utm_content,
    }
    if (params.value !== undefined) body.value = params.value
    if (params.currency) body.currency = params.currency
    if (params.content_ids) body.content_ids = params.content_ids
    if (params.content_name) body.content_name = params.content_name
    if (params.content_type) body.content_type = params.content_type
    post('/api/event', body)
    return eventId
  }

  // API pública
  window.lck = {
    __ready: true,
    id: UID,
    track: track,
    identify: identify,
  }

  // ---- Boot ----
  if (!BASE) {
    // sem base não há como falar com a API; aborta silenciosamente
    return
  }

  fetch(BASE + '/api/track-config', { mode: 'cors' })
    .then(function (r) {
      return r.json()
    })
    .then(function (c) {
      cfg.pixels = (c && c.pixels) || []
      cfg.ga4 = (c && c.ga4) || []
      loadPixel(cfg.pixels)
      loadGtag(cfg.ga4)
      // dá um tempo pro gtag/pixel assentarem os cookies, então identifica
      setTimeout(function () {
        identify().then(function () {
          track('PageView')
        })
      }, 600)
    })
    .catch(function () {
      // mesmo sem config, registra identify/PageView no servidor
      identify().then(function () {
        track('PageView')
      })
    })
})()
