import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";
// Cache 5min en CDN, permite stale-while-revalidate 1h — si rollback, se
// actualiza rápido sin romper tenants.
export const revalidate = 300;

/**
 * JS bundle que el tenant pega en su HTML con:
 *   <script src="https://www.fluxperu.com/kyc-embed.js" async></script>
 *   <button data-flux-kyc="pk_securex_..." data-external-user-id="u_123">
 *     Verificar identidad
 *   </button>
 *
 * Al cargar, FluxKYCEmbed.autoInit() escanea [data-flux-kyc], agrega click
 * handler. Al click: POST /api/kyc/embed/session → iframe modal → postMessage
 * listener → onComplete callback del host.
 *
 * Vanilla JS, zero deps, IE11-compatible (var/function/no optional chaining)
 * para maximizar compat cross-browser sin toolchain del tenant.
 */
export async function GET() {
  return new NextResponse(JS_BUNDLE, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const JS_BUNDLE = `
/* FluxKYC embed v1 — https://www.fluxperu.com */
(function (win, doc) {
  'use strict';
  if (win.FluxKYCEmbed) return; // idempotente si se incluye 2x

  var API_BASE = 'https://www.fluxperu.com';
  var FLOW_PATH = '/kyc/s/';

  function createSession(pk, payload) {
    return fetch(API_BASE + '/api/kyc/embed/session', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + pk,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error(body.detail || body.error || 'HTTP ' + res.status);
        return body;
      });
    });
  }

  function openModal(sessionId, sessionToken, options) {
    var overlay = doc.createElement('div');
    overlay.setAttribute('data-flux-kyc-modal', '');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.75)',
      'z-index:2147483647', 'display:flex', 'align-items:center',
      'justify-content:center', 'padding:16px', 'box-sizing:border-box'
    ].join(';');

    var frame = doc.createElement('iframe');
    frame.setAttribute('allow', 'camera; microphone');
    frame.src = API_BASE + FLOW_PATH + sessionId + '?t=' + encodeURIComponent(sessionToken) + '&embed=1';
    frame.style.cssText = [
      'width:100%', 'height:100%', 'max-width:480px', 'max-height:90vh',
      'border:0', 'border-radius:16px', 'background:#000', 'box-shadow:0 24px 64px rgba(0,0,0,0.4)'
    ].join(';');

    var closeBtn = doc.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.style.cssText = [
      'position:absolute', 'top:16px', 'right:16px', 'width:36px', 'height:36px',
      'border-radius:18px', 'background:rgba(255,255,255,0.12)', 'color:#fff',
      'border:0', 'font-size:22px', 'cursor:pointer', 'line-height:1'
    ].join(';');

    function cleanup() {
      win.removeEventListener('message', onMessage);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function onMessage(event) {
      // Seguridad: solo aceptamos messages desde nuestro propio origin.
      if (event.origin !== API_BASE) return;
      var data = event.data;
      if (!data || data.type !== 'flux-kyc:complete') return;
      cleanup();
      if (typeof options.onComplete === 'function') {
        try { options.onComplete(data.verdict); } catch (_e) { /* swallow */ }
      }
    }

    closeBtn.addEventListener('click', function () {
      cleanup();
      if (typeof options.onCancel === 'function') {
        try { options.onCancel(); } catch (_e) {}
      }
    });

    overlay.appendChild(frame);
    overlay.appendChild(closeBtn);
    doc.body.appendChild(overlay);
    win.addEventListener('message', onMessage, false);
  }

  /**
   * Uso programático:
   *   FluxKYCEmbed.open({ pk: 'pk_xxx', externalUserId: 'u_123', onComplete: fn, onCancel: fn })
   */
  function open(opts) {
    if (!opts || !opts.pk) throw new Error('FluxKYCEmbed.open: { pk } requerido');
    return createSession(opts.pk, {
      external_user_id: opts.externalUserId,
      external_reference: opts.externalReference,
      metadata: opts.metadata
    }).then(function (res) {
      openModal(res.session_id, res.session_token, {
        onComplete: opts.onComplete,
        onCancel: opts.onCancel
      });
      return res;
    });
  }

  /**
   * Escaneo automático: cualquier elemento con [data-flux-kyc=pk] se le
   * attachea un click handler que abre el modal.
   *
   * Atributos soportados:
   *   data-flux-kyc="pk_xxx"              ← publishable key (obligatorio)
   *   data-external-user-id="u_123"       ← ID del user en el tenant
   *   data-external-reference="order-42"  ← ref externa del tenant
   *   data-on-complete="miCallback"       ← nombre de función global
   *
   * onComplete por atributo busca window[nombre]. Alternativa programática:
   *   document.querySelector('#btn').addEventListener('flux-kyc:complete',
   *     function(e) { console.log(e.detail.verdict); });
   */
  function autoInit(root) {
    var scope = root || doc;
    var els = scope.querySelectorAll('[data-flux-kyc]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        if (el.getAttribute('data-flux-kyc-bound') === '1') return;
        el.setAttribute('data-flux-kyc-bound', '1');
        el.addEventListener('click', function (ev) {
          ev.preventDefault();
          var pk = el.getAttribute('data-flux-kyc');
          var externalUserId = el.getAttribute('data-external-user-id') || null;
          var externalReference = el.getAttribute('data-external-reference') || null;
          var onCompleteName = el.getAttribute('data-on-complete');
          var globalCb = onCompleteName ? win[onCompleteName] : null;

          open({
            pk: pk,
            externalUserId: externalUserId,
            externalReference: externalReference,
            onComplete: function (verdict) {
              if (typeof globalCb === 'function') {
                try { globalCb(verdict); } catch (_e) {}
              }
              try {
                el.dispatchEvent(new CustomEvent('flux-kyc:complete', {
                  detail: { verdict: verdict },
                  bubbles: true
                }));
              } catch (_e) {}
            },
            onCancel: function () {
              try {
                el.dispatchEvent(new CustomEvent('flux-kyc:cancel', { bubbles: true }));
              } catch (_e) {}
            }
          }).catch(function (err) {
            console.error('[flux-kyc]', err);
            try {
              el.dispatchEvent(new CustomEvent('flux-kyc:error', {
                detail: { error: String(err && err.message || err) },
                bubbles: true
              }));
            } catch (_e) {}
          });
        });
      })(els[i]);
    }
  }

  win.FluxKYCEmbed = { open: open, autoInit: autoInit };

  // Auto-init on load
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', function () { autoInit(); });
  } else {
    autoInit();
  }
})(window, document);
`;
