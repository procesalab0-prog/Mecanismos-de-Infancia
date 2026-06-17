/* ============================================================
   viewer-extras.js — añade a cada visor 3D (Three.js) dos cosas:
     1) Animación de "Sacar de la bolsa" (abre/desvanece la bolsa)
     2) Control con la mano vía webcam (MediaPipe Hands)
   Reutiliza las variables globales del visor: bag, band, camGoal,
   autoRotate, COMPACT. Solo se activa en modo completo (no en tarjetas).
   ============================================================ */
(function () {
  // En tarjetas (compact) no hay controles ni interacción.
  if (typeof COMPACT !== 'undefined' && COMPACT) return;
  if (typeof bag === 'undefined') return;

  /* ---------------- 1) Animación abrir/cerrar bolsa ---------------- */
  var bagOpen = false, raf = null;
  var band0 = [];
  if (typeof band !== 'undefined' && band && band.children) {
    band.children.forEach(function (c) { if (c.material) band0.push([c, c.material.opacity != null ? c.material.opacity : 1]); });
  }
  function applyBag(t) {           // t: 0 cerrada -> 1 abierta
    var e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;   // easeInOut
    if (bag) {
      bag.material.transparent = true;
      bag.material.opacity = 1 - e;
      bag.scale.setScalar(1 + 0.16 * e);
      bag.position.y = 8 * e;
      bag.visible = e < 0.995;
    }
    if (typeof band !== 'undefined' && band) {
      band0.forEach(function (p) { p[0].material.transparent = true; p[0].material.opacity = p[1] * (1 - e); });
      band.position.y = 34 * e;
      band.visible = e < 0.995;
    }
  }
  function animateBag(to) {
    if (raf) cancelAnimationFrame(raf);
    var from = bagOpen ? 0 : 1, start = performance.now(), dur = 700;
    // from/to expresados como 0..1 destino
    var a0 = to, b0 = (to === 1 ? 0 : 1);   // interpolamos de b0 -> a0
    function step(now) {
      var k = Math.min(1, (now - start) / dur);
      applyBag(b0 + (a0 - b0) * k);
      if (k < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
  }

  // Reemplaza el botón "Bolsa" (le quitamos su listener original clonándolo)
  var oldBag = document.getElementById('btnBag');
  if (oldBag) {
    var btnBag = oldBag.cloneNode(true);
    oldBag.parentNode.replaceChild(btnBag, oldBag);
    setLabel(btnBag, 'Sacar de bolsa');
    btnBag.onclick = function () {
      bagOpen = !bagOpen;
      animateBag(bagOpen ? 1 : 0);
      setLabel(btnBag, bagOpen ? 'Guardar en bolsa' : 'Sacar de bolsa');
      btnBag.classList.toggle('off', bagOpen);
    };
  }

  function setLabel(btn, txt) {
    btn.innerHTML = '<span class="badge"></span>' + txt;
  }

  /* ---------------- 2) Control con la mano (webcam) ---------------- */
  var controls = document.querySelector('.controls');
  var btnHand = document.createElement('button');
  btnHand.id = 'btnHand';
  setLabel(btnHand, 'Controlar con la mano');
  btnHand.classList.add('off');
  if (controls) controls.appendChild(btnHand);

  // panel de vista previa + estado
  var hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:12px;right:12px;z-index:30;display:none;flex-direction:column;align-items:flex-end;gap:6px;';
  var vid = document.createElement('video');
  vid.muted = true; vid.playsInline = true; vid.setAttribute('playsinline','');
  vid.style.cssText = 'width:132px;height:99px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.25);transform:scaleX(-1);background:#000;box-shadow:0 8px 24px rgba(0,0,0,.4);';
  var status = document.createElement('div');
  status.style.cssText = 'font:600 10.5px/1.4 "JetBrains Mono",ui-monospace,monospace;color:#e9eef3;background:rgba(16,21,28,.78);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:5px 8px;backdrop-filter:blur(10px);max-width:150px;text-align:right;';
  status.textContent = 'Iniciando…';
  hud.appendChild(vid); hud.appendChild(status);
  document.body.appendChild(hud);

  var tracking = false, stream = null, hands = null, mpLoaded = false, sending = false;

  btnHand.onclick = function () {
    if (tracking) stopHand(); else startHand();
  };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = function () { rej(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function startHand() {
    btnHand.classList.remove('off');
    setLabel(btnHand, 'Quitar la mano');
    hud.style.display = 'flex';
    status.textContent = 'Pidiendo cámara…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false });
    } catch (e) {
      status.textContent = 'Sin acceso a la cámara';
      btnHand.classList.add('off'); setLabel(btnHand, 'Controlar con la mano');
      return;
    }
    vid.srcObject = stream;
    await vid.play().catch(function () {});
    if (!mpLoaded) {
      status.textContent = 'Cargando seguimiento…';
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js');
        mpLoaded = true;
      } catch (e) {
        status.textContent = 'No se pudo cargar el seguimiento';
        return;
      }
    }
    if (!hands) {
      /* global Hands */
      hands = new Hands({ locateFile: function (f) { return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/' + f; } });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
      hands.onResults(onResults);
    }
    tracking = true;
    if (typeof autoRotate !== 'undefined') autoRotate = false;
    status.textContent = 'Mueve la mano ✋';
    pump();
  }

  async function pump() {
    if (!tracking) return;
    if (!sending && vid.readyState >= 2) {
      sending = true;
      try { await hands.send({ image: vid }); } catch (e) {}
      sending = false;
    }
    requestAnimationFrame(pump);
  }

  function onResults(res) {
    if (!tracking) return;
    if (res.multiHandLandmarks && res.multiHandLandmarks.length) {
      var lm = res.multiHandLandmarks[0][9];     // base del dedo medio (centro de la palma aprox.)
      // imagen reflejada -> invertimos x para que se sienta natural
      camGoal.theta = (0.5 - lm.x) * Math.PI * 2.2;
      camGoal.phi = Math.max(0.35, Math.min(2.85, 0.5 + lm.y * 2.0));
      status.textContent = 'Siguiendo tu mano ✋';
    } else {
      status.textContent = 'Muestra tu mano a la cámara';
    }
  }

  function stopHand() {
    tracking = false;
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    vid.srcObject = null;
    hud.style.display = 'none';
    btnHand.classList.add('off');
    setLabel(btnHand, 'Controlar con la mano');
  }

  window.addEventListener('pagehide', stopHand);
})();
