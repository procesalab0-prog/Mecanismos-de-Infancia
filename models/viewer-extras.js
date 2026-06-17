/* ============================================================
   viewer-extras.js — añade a cada visor 3D (Three.js) dos cosas:
     1) Animación de "Sacar de la bolsa" (abre/desvanece la bolsa)
     2) Control con la mano vía webcam (MediaPipe Hands):
        - mover la mano  -> gira el juguete
        - mano cerca/lejos -> acerca/aleja (zoom)
        - el monitor muestra SOLO el esqueleto de la mano (no la cámara)
   Reutiliza las variables globales del visor: bag, band, camGoal,
   CAM_DEFAULT, autoRotate, COMPACT. Solo en modo completo (no tarjetas).
   ============================================================ */
(function () {
  if (typeof COMPACT !== 'undefined' && COMPACT) return;   // en tarjetas no
  if (typeof bag === 'undefined') return;

  var rBase = (typeof CAM_DEFAULT !== 'undefined' && CAM_DEFAULT.r) ? CAM_DEFAULT.r : (typeof camGoal !== 'undefined' ? camGoal.r : 200);

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
    var start = performance.now(), dur = 700, from = (to === 1 ? 0 : 1);
    function step(now) {
      var k = Math.min(1, (now - start) / dur);
      applyBag(from + (to - from) * k);
      if (k < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
  }

  function setLabel(btn, txt) { btn.innerHTML = '<span class="badge"></span>' + txt; }

  var oldBag = document.getElementById('btnBag');
  if (oldBag) {
    var btnBag = oldBag.cloneNode(true);          // quita el listener original
    oldBag.parentNode.replaceChild(btnBag, oldBag);
    setLabel(btnBag, 'Sacar de bolsa');
    btnBag.onclick = function () {
      bagOpen = !bagOpen;
      animateBag(bagOpen ? 1 : 0);
      setLabel(btnBag, bagOpen ? 'Guardar en bolsa' : 'Sacar de bolsa');
      btnBag.classList.toggle('off', bagOpen);
    };
  }

  /* ---------------- 2) Control con la mano (webcam) ---------------- */
  var controls = document.querySelector('.controls');
  var btnHand = document.createElement('button');
  btnHand.id = 'btnHand';
  setLabel(btnHand, 'Controlar con la mano');
  btnHand.classList.add('off');
  if (controls) controls.appendChild(btnHand);

  // HUD: lienzo con el esqueleto de la mano + estado (NO muestra la cámara)
  var hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:12px;right:12px;z-index:30;display:none;flex-direction:column;align-items:flex-end;gap:6px;';
  var cv = document.createElement('canvas');
  cv.width = 176; cv.height = 132;
  cv.style.cssText = 'width:148px;height:111px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#10151c;box-shadow:0 8px 24px rgba(0,0,0,.4);';
  var cx = cv.getContext('2d');
  var status = document.createElement('div');
  status.style.cssText = 'font:600 10.5px/1.4 "JetBrains Mono",ui-monospace,monospace;color:#e9eef3;background:rgba(16,21,28,.78);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:5px 8px;backdrop-filter:blur(10px);max-width:160px;text-align:right;';
  status.textContent = 'Iniciando…';
  hud.appendChild(cv); hud.appendChild(status);
  document.body.appendChild(hud);

  // vídeo oculto: solo alimenta a MediaPipe, no se muestra
  var vid = document.createElement('video');
  vid.muted = true; vid.playsInline = true; vid.setAttribute('playsinline', '');
  vid.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:-10px;top:-10px;';
  document.body.appendChild(vid);

  // conexiones del esqueleto de la mano (21 puntos de MediaPipe)
  var CONN = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
  ];
  function drawHand(L) {
    cx.fillStyle = '#10151c'; cx.fillRect(0, 0, cv.width, cv.height);
    if (!L) return;
    cx.save();
    cx.translate(cv.width, 0); cx.scale(-1, 1);             // espejo, como el HUD natural
    function P(i) { return [L[i].x * cv.width, L[i].y * cv.height]; }
    cx.strokeStyle = '#7fd1c7'; cx.lineWidth = 2.4; cx.lineCap = 'round';
    cx.beginPath();
    CONN.forEach(function (c) { var a = P(c[0]), b = P(c[1]); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); });
    cx.stroke();
    cx.fillStyle = '#e9eef3';
    for (var i = 0; i < L.length; i++) { var p = P(i); cx.beginPath(); cx.arc(p[0], p[1], 2.6, 0, Math.PI * 2); cx.fill(); }
    cx.restore();
  }

  var tracking = false, stream = null, hands = null, mpLoaded = false, sending = false;

  btnHand.onclick = function () { if (tracking) stopHand(); else startHand(); };

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
    drawHand(null);
    status.textContent = 'Pidiendo cámara…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false });
    } catch (e) {
      status.textContent = 'Sin acceso a la cámara';
      btnHand.classList.add('off'); setLabel(btnHand, 'Controlar con la mano');
      hud.style.display = 'none';
      return;
    }
    vid.srcObject = stream;
    await vid.play().catch(function () {});
    if (!mpLoaded) {
      status.textContent = 'Cargando seguimiento…';
      try { await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js'); mpLoaded = true; }
      catch (e) { status.textContent = 'No se pudo cargar el seguimiento'; return; }
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
      var L = res.multiHandLandmarks[0];
      var palm = L[9];                                 // base del dedo medio
      // girar: posición de la mano en el encuadre (imagen reflejada -> invertimos x)
      camGoal.theta = (0.5 - palm.x) * Math.PI * 2.2;
      camGoal.phi = Math.max(0.35, Math.min(2.85, 0.5 + palm.y * 2.0));
      // acercar/alejar: tamaño aparente de la mano (muñeca -> nudillo medio)
      var size = Math.hypot(L[0].x - palm.x, L[0].y - palm.y);   // ~0.10 (lejos) .. 0.34 (cerca)
      var k = Math.max(0, Math.min(1, (size - 0.12) / (0.30 - 0.12)));
      camGoal.r = rBase * (1.7 - 1.15 * k);            // mano grande/cerca -> menor r (zoom in)
      drawHand(L);
      status.textContent = 'Siguiendo tu mano ✋';
    } else {
      drawHand(null);
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
