/* First Signs motion engine v4.
   Scroll-agnostic: nothing depends on tracking the scroll position of the
   host frame. Visibility (IntersectionObserver), timers and the pointer drive
   every effect. Native scrolling everywhere. Everything degrades: no WebGL,
   no library, or reduced-motion => the CSS-only version remains. */
(function () {
  "use strict";
  setTimeout(function () {
    var p = document.getElementById("preloader"); if (p) p.classList.add("done");
    document.documentElement.style.overflow = "";
  }, 3200);
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var fine = false;
  try { fine = window.matchMedia("(pointer: fine)").matches; } catch (e) {}
  var hasGsap = typeof window.gsap !== "undefined";
  var hasIO = typeof window.IntersectionObserver !== "undefined";

  /* run fn once when el becomes visible (fallback: immediately) */
  function onVisible(el, fn, margin, once) {
    if (!el) return;
    if (!hasIO) { fn(true); return; }
    if (once === undefined) once = true;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting) { fn(true); if (once) io.unobserve(x.target); }
        else if (!once) fn(false);
      });
    }, { rootMargin: margin || "0px 0px -8% 0px", threshold: 0.05 });
    io.observe(el);
  }

  /* ---------------- native anchors ---------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href"); if (id.length < 2) return;
      var el = null; try { el = document.querySelector(id); } catch (x) {}
      if (!el) return;
      e.preventDefault();
      var y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---------------- WebGL hero ---------------- */
  var canvas = document.getElementById("hero3d");
  var hero = document.querySelector(".hero");
  if (canvas && hero && typeof window.THREE !== "undefined" && !reduce) {
    try {
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setClearColor(0x000000, 0);
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, 2, 0.1, 100);
      camera.position.set(0, 0.15, 7.2);
      var uniforms = {
        uTime: { value: 0 },
        uNavy: { value: new THREE.Color(0x0F2E52) },
        uTeal: { value: new THREE.Color(0x0E7490) },
        uGold: { value: new THREE.Color(0xE8B84B) },
        uMouse: { value: new THREE.Vector2(0, 0) }
      };
      var vert = [
        "uniform float uTime; uniform vec2 uMouse;",
        "varying vec2 vUv; varying float vH;",
        "float n(vec2 p){ return sin(p.x*1.7+uTime*0.6)*0.55 + sin(p.x*3.1-uTime*0.35+p.y*2.0)*0.25 + sin(p.x*0.6+uTime*0.22)*0.7; }",
        "void main(){",
        "  vUv = uv; vec3 p = position;",
        "  float h = n(p.xy) * 0.42; h += sin(p.y*4.0 + uTime*0.5)*0.05;",
        "  h += uMouse.x * 0.12 * sin(p.x*0.8) + uMouse.y*0.06;",
        "  p.z += h; p.y += sin(p.x*0.35 + uTime*0.18)*0.18; vH = h;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);",
        "}"].join("\n");
      var frag = [
        "uniform vec3 uNavy; uniform vec3 uTeal; uniform vec3 uGold;",
        "varying vec2 vUv; varying float vH;",
        "void main(){",
        "  float t = smoothstep(0.0,1.0,vUv.x); vec3 col = mix(uNavy, uTeal, t);",
        "  float crest = smoothstep(0.18,0.55,vH); col = mix(col, uGold, crest*0.55);",
        "  float edge = smoothstep(0.0,0.12,vUv.y)*smoothstep(1.0,0.88,vUv.y);",
        "  gl_FragColor = vec4(col, 0.62*edge);",
        "}"].join("\n");
      function ribbon(y, z, rot, w, hgt, seg) {
        var geo = new THREE.PlaneGeometry(w, hgt, seg, 12);
        var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, side: THREE.DoubleSide, depthWrite: false });
        var m = new THREE.Mesh(geo, mat);
        m.position.set(0.6, y, z); m.rotation.set(rot, 0, -0.16);
        scene.add(m); return m;
      }
      ribbon(0.55, -1.2, -0.55, 12, 1.5, 120);
      ribbon(-0.15, -0.4, -0.62, 11, 1.1, 110);
      ribbon(-0.9, 0.5, -0.7, 10, 0.8, 96);
      var count = 220, pos = new Float32Array(count * 3), spd = new Float32Array(count);
      for (var i = 0; i < count; i++) {
        pos[i*3] = (Math.random() - 0.5) * 14; pos[i*3+1] = (Math.random() - 0.5) * 6; pos[i*3+2] = (Math.random() - 0.5) * 4 - 1;
        spd[i] = 0.2 + Math.random() * 0.8;
      }
      var pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      var points = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: 0x0E7490, size: 0.045, transparent: true, opacity: 0.45, sizeAttenuation: true, depthWrite: false })); scene.add(points);
      var gpos = new Float32Array(60 * 3);
      for (var j = 0; j < 60; j++) { gpos[j*3] = (Math.random()-0.5)*12; gpos[j*3+1] = (Math.random()-0.5)*5; gpos[j*3+2] = (Math.random()-0.5)*3; }
      var ggeo = new THREE.BufferGeometry(); ggeo.setAttribute("position", new THREE.BufferAttribute(gpos, 3));
      var gold = new THREE.Points(ggeo, new THREE.PointsMaterial({ color: 0xE8B84B, size: 0.07, transparent: true, opacity: 0.6, sizeAttenuation: true, depthWrite: false })); scene.add(gold);
      hero.classList.add("has-3d");
      var mouse = { x: 0, y: 0 }, target = { x: 0, y: 0 };
      if (fine) window.addEventListener("pointermove", function (e) {
        target.x = (e.clientX / window.innerWidth - 0.5) * 2;
        target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
      function resize() {
        var w = hero.clientWidth, h = hero.clientHeight;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      resize(); window.addEventListener("resize", resize);
      var visible = true;
      onVisible(hero, function (v) { visible = v; }, "0px", false);
      var clock = new THREE.Clock(), fskip = false;
      function frame() {
        requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        fskip = !fskip; if (fskip) return;
        var t = clock.getElapsedTime();
        uniforms.uTime.value = t;
        mouse.x += (target.x - mouse.x) * 0.04; mouse.y += (target.y - mouse.y) * 0.04;
        uniforms.uMouse.value.set(mouse.x, mouse.y);
        camera.position.x = mouse.x * 0.35; camera.position.y = 0.15 - mouse.y * 0.2;
        camera.lookAt(0.3, 0, 0);
        var pa = pgeo.attributes.position.array;
        for (var k = 0; k < count; k++) {
          pa[k*3+1] += 0.0012 * spd[k]; pa[k*3] += Math.sin(t*0.3 + k) * 0.0006;
          if (pa[k*3+1] > 3.2) pa[k*3+1] = -3.2;
        }
        pgeo.attributes.position.needsUpdate = true;
        gold.rotation.y = t * 0.03; points.rotation.y = -t * 0.015;
        renderer.render(scene, camera);
      }
      frame();
    } catch (e) { /* CSS hero remains */ }
  }

  /* ---------------- preloader (once per session) + curtain ---------------- */
  var pre = document.getElementById("preloader");
  var curtain = document.getElementById("curtain");
  var seenIntro = false;
  try { seenIntro = window.sessionStorage.getItem("fs_intro") === "1"; } catch (e) {}
  if (pre) { pre.classList.add("done"); }
  if (false) {
    if (document.documentElement.classList.contains("reg-lock")) {
      /* the registration dialog is the welcome; skip the intro for this visit */
      try { window.sessionStorage.setItem("fs_intro", "1"); } catch (e) {}
      pre.classList.add("done");
    }
    else if (!hasGsap || reduce || seenIntro) { pre.classList.add("done"); }
    else {
      try { window.sessionStorage.setItem("fs_intro", "1"); } catch (e) {}
      document.documentElement.style.overflow = "hidden";
      var bar = pre.querySelector(".pre-bar span");
      gsap.timeline({ onComplete: function () { pre.classList.add("done"); document.documentElement.style.overflow = ""; } })
        .from(".pre-mark", { y: 18, opacity: 0, duration: .5, ease: "power2.out" })
        .to(bar, { width: "100%", duration: .75, ease: "power2.inOut" }, 0.1)
        .to(pre, { yPercent: -100, duration: .7, ease: "power4.inOut" }, 0.95);
    }
  }

  /* ---------------- story stepper (home): click, arrows, keys, auto ---------------- */
  var story = document.querySelector(".story");
  if (story) {
    var steps = Array.prototype.slice.call(story.querySelectorAll(".story-step"));
    var labels = Array.prototype.slice.call(story.querySelectorAll(".story-label"));
    var num = story.querySelector(".story-num");
    var arc = story.querySelector(".story-arc path");
    var small = num ? num.querySelector("small") : null;
    var smallText = small ? small.textContent : "";
    var cur = 0, timer = null, len = 0;
    if (arc) { try { len = arc.getTotalLength(); arc.style.strokeDasharray = len; arc.style.strokeDashoffset = len * 0.75; arc.style.transition = "stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)"; } catch (e) {} }
    function show(i) {
      i = (i + steps.length) % steps.length; cur = i;
      steps.forEach(function (s, k) { s.classList.toggle("on", k === i); });
      labels.forEach(function (l, k) { l.classList.toggle("on", k === i); l.setAttribute("aria-selected", k === i ? "true" : "false"); });
      if (num) num.innerHTML = String(i + 1).padStart(2, "0") + "<small>" + smallText + "</small>";
      if (arc && len) arc.style.strokeDashoffset = (1 - (i + 1) / steps.length) * len;
      if (hasGsap && !reduce) {
        var s = steps[i];
        gsap.fromTo(s.children, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .08, ease: "power3.out", overwrite: true, clearProps: "transform,opacity" });
      }
    }
    function restart() { if (timer) clearInterval(timer); if (reduce) return; timer = setInterval(function () { if (!document.hidden && storyVis) show(cur + 1); }, 5200); }
    var storyVis = false;
    onVisible(story, function (v) { storyVis = v; }, "0px", false);
    labels.forEach(function (l, k) { l.setAttribute("role", "tab"); l.setAttribute("tabindex", "0"); l.addEventListener("click", function () { show(k); restart(); });
      l.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(k); restart(); } }); });
    story.querySelectorAll("[data-story-prev]").forEach(function (b) { b.addEventListener("click", function () { show(cur - 1); restart(); }); });
    story.querySelectorAll("[data-story-next]").forEach(function (b) { b.addEventListener("click", function () { show(cur + 1); restart(); }); });
    story.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { show(cur + 1); restart(); } if (e.key === "ArrowLeft") { show(cur - 1); restart(); } });
    /* swipe */
    var sx = null;
    story.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    story.addEventListener("touchend", function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 48) { show(cur + (dx < 0 ? 1 : -1)); restart(); } sx = null; }, { passive: true });
    show(0); restart();
  }

  /* ---------------- horizontal gallery (home): native snap + arrows + drag ---------------- */
  var gal = document.querySelector(".hgal");
  if (gal) {
    var track = gal.querySelector(".hgal-track");
    if (track) {
      var cards = track.querySelectorAll(".hgal-card");
      var headC = gal.querySelector(".hgal-head");
      function alignTrack() {
        if (!headC) return;
        var cs = getComputedStyle(headC);
        var pad = Math.max(16, Math.round(headC.getBoundingClientRect().left + parseFloat(cs.paddingLeft)));
        track.style.paddingLeft = pad + "px"; track.style.paddingRight = pad + "px"; track.style.scrollPaddingLeft = pad + "px";
      }
      alignTrack(); window.addEventListener("resize", alignTrack);
      function stepW() { return cards.length ? cards[0].getBoundingClientRect().width + 22 : 320; }
      gal.querySelectorAll("[data-gal-prev]").forEach(function (b) { b.addEventListener("click", function () { track.scrollBy({ left: -stepW(), behavior: "smooth" }); }); });
      gal.querySelectorAll("[data-gal-next]").forEach(function (b) { b.addEventListener("click", function () { track.scrollBy({ left: stepW(), behavior: "smooth" }); }); });
      if (fine) {
        var down = false, startX = 0, startL = 0, moved = false;
        track.addEventListener("pointerdown", function (e) { down = true; moved = false; startX = e.clientX; startL = track.scrollLeft; track.classList.add("drag"); });
        window.addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - startX; if (Math.abs(dx) > 4) moved = true; track.scrollLeft = startL - dx; });
        window.addEventListener("pointerup", function () { down = false; track.classList.remove("drag"); });
        track.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
      }
      onVisible(gal, function () {
        if (hasGsap && !reduce) gsap.fromTo(cards, { y: 36, opacity: 0 }, { y: 0, opacity: 1, stagger: .09, duration: .8, ease: "power3.out", clearProps: "transform,opacity" });
      });
    }
  }

  /* ---------------- 2D aurora in inner-page headers ---------------- */
  var phc = document.querySelector(".ph-canvas");
  if (phc && !reduce) {
    try {
      var ctx2 = phc.getContext("2d"), pw = 0, ph = 0, head = phc.parentElement;
      var sizeC = function () { pw = head.clientWidth; ph = head.clientHeight; phc.width = pw; phc.height = ph; };
      sizeC(); window.addEventListener("resize", sizeC);
      var pts = []; for (var q = 0; q < 28; q++) pts.push({ x: Math.random() * 1.2, y: Math.random(), r: 1 + Math.random() * 2.2, s: 0.00025 + Math.random() * 0.0006, c: q % 5 === 0 ? "232,184,75" : "14,116,144" });
      var vis = true; onVisible(head, function (v) { vis = v; }, "0px", false);
      var fr = 0;
      var draw = function (ts) {
        requestAnimationFrame(draw);
        fr = (fr + 1) % 3; if (!vis || fr || document.hidden) return;
        var t = ts * 0.001; ctx2.clearRect(0, 0, pw, ph);
        for (var b = 0; b < 2; b++) {
          ctx2.beginPath();
          for (var x = 0; x <= pw; x += 22) {
            var y = ph * (0.55 + b * 0.13) + Math.sin(x * 0.006 + t * (0.5 + b * 0.18) + b) * (18 + b * 8) + Math.sin(x * 0.013 - t * 0.35) * 8;
            if (x === 0) ctx2.moveTo(x, y); else ctx2.lineTo(x, y);
          }
          ctx2.lineTo(pw, ph); ctx2.lineTo(0, ph); ctx2.closePath();
          var g = ctx2.createLinearGradient(0, ph * 0.4, 0, ph);
          g.addColorStop(0, "rgba(14,116,144," + (0.10 - b * 0.025) + ")"); g.addColorStop(1, "rgba(14,116,144,0)");
          ctx2.fillStyle = g; ctx2.fill();
        }
        pts.forEach(function (p) {
          p.y -= p.s; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random() * 1.2; }
          ctx2.beginPath(); ctx2.arc(p.x * pw, p.y * ph, p.r, 0, Math.PI * 2);
          ctx2.fillStyle = "rgba(" + p.c + "," + (0.35 + Math.sin(t * 2 + p.x * 10) * 0.2) + ")"; ctx2.fill();
        });
      };
      requestAnimationFrame(draw);
    } catch (e) {}
  }

  /* ---------------- spotlight + icons (no library needed) ---------------- */
  if (fine) document.addEventListener("pointermove", function (e) {
    var c = e.target.closest(".card-fs, .tile, .doc-card, .qlist, .hgal-card, .type-card");
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
    c.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
  }, { passive: true });
  var ICONS = [
    '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>',
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    '<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h8"/>',
    '<path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10z"/><circle cx="12" cy="11" r="2.5"/>',
    '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"/>',
    '<path d="M4 19V5a1 1 0 0 1 1-1h6l2 2h6a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>',
    '<path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/>'
  ];
  document.querySelectorAll(".page-body .card-fs > h3, .page-body .qlist > h3").forEach(function (h, i) {
    if (h.querySelector(".ic")) return;
    var ic = document.createElement("span"); ic.className = "ic";
    ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[i % ICONS.length] + "</svg>";
    h.insertBefore(ic, h.firstChild);
  });

  /* ---------------- counters, charts, timelines, TOC (visibility-driven) ---------------- */
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var end = parseFloat(el.getAttribute("data-count")), dec = parseInt(el.getAttribute("data-dec") || "0", 10);
    var fmt = function (v) { return dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-IN"); };
    onVisible(el, function () {
      if (!hasGsap || reduce) { el.textContent = fmt(end); return; }
      var o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.8, ease: "power3.out", onUpdate: function () { el.textContent = fmt(o.v); } });
    }, "0px 0px -5% 0px");
  });
  document.querySelectorAll("[data-scrub]").forEach(function (p) {
    var words = p.textContent.trim().split(/\s+/);
    p.innerHTML = words.map(function (w) { return "<span class='sw'>" + w + "</span>"; }).join(" ");
    var sw = p.querySelectorAll(".sw");
    onVisible(p, function () {
      if (!hasGsap || reduce) { sw.forEach(function (s) { s.style.opacity = 1; }); return; }
      gsap.to(sw, { opacity: 1, stagger: 0.035, duration: .5, ease: "power1.out" });
    }, "0px 0px -5% 0px");
  });
  document.querySelectorAll("[data-chart]").forEach(function (card) {
    onVisible(card, function () {
      card.classList.add("on");
      if (!hasGsap || reduce) {
        card.querySelectorAll(".bar-fill").forEach(function (f) { f.style.transform = "scaleX(" + (parseFloat(f.getAttribute("data-w")) || 1) + ")"; });
        card.querySelectorAll(".win-seg").forEach(function (f) { f.style.transform = "scaleX(1)"; });
        card.querySelectorAll("[data-ring]").forEach(function (r) { var total = parseFloat(r.getAttribute("stroke-dasharray")); r.style.strokeDashoffset = total * (1 - parseFloat(r.getAttribute("data-ring"))); });
        return;
      }
      card.querySelectorAll(".bar-fill").forEach(function (f, i) { gsap.to(f, { scaleX: parseFloat(f.getAttribute("data-w")) || 1, duration: 1.2, delay: i * .08, ease: "power3.out" }); });
      gsap.to(card.querySelectorAll(".win-seg"), { scaleX: 1, duration: 1, stagger: 0.06, ease: "power3.out" });
      card.querySelectorAll("[data-ring]").forEach(function (r) {
        var total = parseFloat(r.getAttribute("stroke-dasharray")), p = parseFloat(r.getAttribute("data-ring"));
        gsap.to(r, { strokeDashoffset: total * (1 - p), duration: 1.4, ease: "power3.out" });
      });
    }, "0px 0px -10% 0px");
  });
  document.querySelectorAll("[data-tl]").forEach(function (tlEl) {
    onVisible(tlEl, function () {
      var line = tlEl.querySelector(".tl-line");
      if (line) { line.style.transition = "transform 1.6s cubic-bezier(.2,.7,.2,1)"; line.style.transform = "scaleY(1)"; }
      if (hasGsap && !reduce) gsap.fromTo(tlEl.querySelectorAll(".tl-item"), { x: -14, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.14, duration: 0.6, ease: "power2.out", clearProps: "transform,opacity" });
    }, "0px 0px -10% 0px");
  });
  var tocLinks = document.querySelectorAll(".toc a[href^='#']");
  if (tocLinks.length && hasIO) {
    var map = {};
    tocLinks.forEach(function (a) { var id = a.getAttribute("href").slice(1); var sec = document.getElementById(id); if (sec) map[id] = a; });
    var io2 = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { tocLinks.forEach(function (l) { l.classList.remove("on"); }); map[x.target.id].classList.add("on"); } });
    }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });
    Object.keys(map).forEach(function (id) { io2.observe(document.getElementById(id)); });
  }

  /* ---------------- visibility reveals ----------------
     One system only (the CSS .reveal fallback is switched off when GSAP runs).
     Content is never fully hidden: it starts slightly faded and offset, and the
     entrance replays every time a block comes up from below, so the page keeps
     moving the whole way down and back. A safety net restores anything left
     mid-animation. */
  var revealSel = ".reveal, .page-body > p, .page-body > ul, .page-body > ol, .page-body > .tbl-scroll, .page-body > .glance, .page-body > .card-fs, .page-pad h2, .story h2, [data-keyband], .fearon-band, .type-card, .tile, .doc-card, .stat, .proc-step, .qlist, .card-fs, .thread, .accordion-item, .review-block";
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(revealSel));
  if (hasGsap && !reduce && hasIO) {
    revealEls = revealEls.filter(function (el) { return !revealEls.some(function (o) { return o !== el && o.contains(el); }); });
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.remove("reveal"); el.classList.add("in"); });
    var ioR = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        var el = x.target;
        if (x.isIntersecting) {
          if (el._fsHidden) {
            el._fsHidden = false;
            var kb = el.hasAttribute("data-keyband") || el.classList.contains("fearon-band");
            gsap.fromTo(el, { y: kb ? 34 : 26, opacity: .25, scale: kb ? .965 : .985 },
              { y: 0, opacity: 1, scale: 1, duration: kb ? .9 : .7, delay: (el._fsIdx % 4) * .05, ease: "power3.out", overwrite: true, clearProps: "transform,opacity" });
          }
          ioR.unobserve(el);
        }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    revealEls.forEach(function (el, i) {
      el._fsIdx = i;
      if (el.getBoundingClientRect().top > window.innerHeight * .95) { el._fsHidden = true; gsap.set(el, { y: 26, opacity: .25 }); }
      ioR.observe(el);
    });
    /* safety net: anything on screen that is still faded gets restored */
    setInterval(function () {
      var vh = window.innerHeight;
      revealEls.forEach(function (el) {
        if (!el._fsHidden) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * .9 && r.bottom > 0) { el._fsHidden = false; gsap.to(el, { y: 0, opacity: 1, scale: 1, duration: .5, overwrite: true, clearProps: "transform,opacity" }); }
      });
    }, 1500);
    document.querySelectorAll(".page-pad .lead-fs").forEach(function (p) {
      gsap.from(p, { y: 16, opacity: 0, duration: .8, ease: "power2.out", delay: .2, clearProps: "all" });
    });
  }


  /* ---------------- opening: door, then the page arrives slowly ----------------
     Once per visit the site opens like a door: the name is drawn in gold,
     the two halves slide apart, and the page comes in piece by piece. If the
     registration dialog is waiting, the page arrives as soon as it closes. */
  (function () {
    var d = document.documentElement, entered = false, slow = d.classList.contains("door-on");
    function inView(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight * .98 && r.height > 0; }
    function splitWords(h) {
      if (!h || h.dataset.split || h.querySelector("*:not(br):not(span)")) return null;
      h.dataset.split = "1";
      var label = h.textContent.trim().replace(/\s+/g, " ");
      h.setAttribute("aria-label", label);
      h.innerHTML = label.split(" ").map(function (w) { return "<span class='mw' aria-hidden='true'><span>" + w + "</span></span>"; }).join(" ");
      return h.querySelectorAll(".mw > span");
    }
    function enter() {
      if (entered) return; entered = true;
      d.classList.remove("fs-wait");
      if (!hasGsap || reduce) return;
      var k = slow ? 1.35 : .6;
      var tl = gsap.timeline();
      var top = [].slice.call(document.querySelectorAll(".draft-ribbon, .site-header"));
      if (top.length) tl.from(top, { y: -26, opacity: 0, duration: .9 * k, ease: "power3.out", stagger: .08, clearProps: "transform,opacity" }, 0);
      var head = document.querySelector(".hero .hero-inner") || document.querySelector(".page-head .ph-inner");
      if (head) {
        var h1 = head.querySelector("h1"), words = splitWords(h1);
        var kids = [].slice.call(head.querySelectorAll(":scope > *, :scope > .row > * > *, :scope > div > *")).filter(function (el) { return el !== h1 && !el.contains(h1) && el.offsetParent !== null; });
        var crumbs = document.querySelector(".crumbs");
        if (crumbs) tl.from(crumbs, { opacity: 0, y: 10, duration: .7 * k, ease: "power2.out", clearProps: "transform,opacity" }, .25 * k);
        if (words && words.length) tl.from(words, { yPercent: 110, duration: 1.1 * k, ease: "power4.out", stagger: .075 * k, clearProps: "transform" }, .35 * k);
        if (kids.length) tl.from(kids, { y: 26, opacity: 0, filter: "blur(6px)", duration: 1.15 * k, ease: "power3.out", stagger: .2 * k, clearProps: "transform,opacity,filter" }, .75 * k);
      }
      var art = document.querySelectorAll(".ph-art, .ph-orb, .hero-orbs, #hero3d, .hero-lines");
      if (art.length) tl.from(art, { opacity: 0, scale: .94, duration: 1.6 * k, ease: "power2.out", clearProps: "transform,opacity" }, .5 * k);
      var below = [].slice.call(document.querySelectorAll("main > *:not(.hero):not(.page-head):not(.crumbs), .page-pad > *, .page-body > *, main > section > .container > *"))
        .filter(function (el) { return !el.closest(".hero") && !el.closest(".page-head") && inView(el) && !below_has(el); });
      function below_has(el) { return false; }
      below = below.filter(function (el, i) { return !below.some(function (o) { return o !== el && o.contains(el); }); }).slice(0, 8);
      if (below.length) tl.from(below, { y: 34, opacity: 0, duration: 1.1 * k, ease: "power3.out", stagger: .16 * k, clearProps: "transform,opacity" }, 1.35 * k);
    }
    function startWriting(done) {
      var door = document.getElementById("fsDoor"); if (!door) { done(); return; }
      var rects = door.querySelectorAll(".wr"), nibs = door.querySelectorAll(".nib"), txt = door.querySelector(".wt");
      var ran = false;
      var go = function () {
        if (ran) return; ran = true;
        var x0 = 80, x1 = 920, top = 40, bot = 220;
        try { var bb = txt.getBBox(); if (bb.width > 50) { x0 = bb.x; x1 = bb.x + bb.width; top = bb.y; bot = bb.y + bb.height; } } catch (e) {}
        door.classList.add("writing");
        var t0 = performance.now(), D = 2400, mid = top + (bot - top) * .55, amp = (bot - top) * .22;
        var step = function (t) {
          var q = Math.min(1, (t - t0) / D), e = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          var x = x0 + e * (x1 - x0);
          rects.forEach(function (r) { r.setAttribute("width", Math.max(0, x + 6)); });
          nibs.forEach(function (nb) { nb.setAttribute("cx", x.toFixed(1)); nb.setAttribute("cy", (mid + Math.sin(q * 30) * amp).toFixed(1)); });
          if (q < 1) requestAnimationFrame(step);
          else { rects.forEach(function (r) { r.setAttribute("width", 1000); }); door.classList.add("written"); setTimeout(done, 650); }
        };
        requestAnimationFrame(step);
      };
      try {
        if (document.fonts && document.fonts.load) document.fonts.load('700 128px "Playfair Display"').then(function () { setTimeout(go, 120); }, go);
        else go();
      } catch (e) { go(); }
      setTimeout(go, 1500);
    }
    function afterDoor() {
      if (d.classList.contains("reg-lock")) {
        var done = function () { document.removeEventListener("fs:regclosed", done); slow = true; setTimeout(enter, 60); };
        document.addEventListener("fs:regclosed", done);
        d.classList.remove("fs-wait");
      } else enter();
    }
    if (d.classList.contains("door-on") && document.getElementById("fsDoor")) {
      var opened = false;
      var open = function () {
        if (opened) return; opened = true;
        try { window.sessionStorage.setItem("fs_door", "1"); } catch (e) {}
        d.classList.add("door-open");
        setTimeout(function () { d.classList.remove("door-on"); }, 1350);
        setTimeout(afterDoor, d.classList.contains("reg-lock") ? 250 : 950);
      };
      startWriting(function () { setTimeout(open, 750); });
      setTimeout(open, 7500);
      document.getElementById("fsDoor").addEventListener("click", open);
    } else {
      d.classList.remove("door-on");
      afterDoor();
    }
  })();

  /* ---------------- hero text entrance ---------------- */
  var heroH1 = document.querySelector(".hero h1");
  if (false) {
    heroH1.dataset.split = "1";
    var words = heroH1.textContent.split(" ");
    heroH1.innerHTML = words.map(function (w) { return "<span class='w'><span>" + w + "</span></span>"; }).join(" ");
    gsap.from(".hero h1 .w > span", { yPercent: 105, duration: 0.9, ease: "power3.out", stagger: 0.045, delay: 0.1, clearProps: "all" });
    gsap.from(".hero .hero-ctas, .hero .eyebrow", { y: 18, opacity: 0, duration: 0.8, ease: "power2.out", stagger: 0.12, delay: 0.45, clearProps: "all" });
  }

  /* ---------------- floaters + pointer parallax (no scroll) ---------------- */
  if (hasGsap && !reduce) {
    document.querySelectorAll(".ph-art [data-float], .hero-orbs > *, .kb-orb").forEach(function (el, i) {
      gsap.to(el, { y: "+=" + (8 + (i % 4) * 5), x: "+=" + ((i % 3) - 1) * 6, rotation: (i % 2 ? 1 : -1) * 1.5, duration: 3.2 + (i % 5), yoyo: true, repeat: -1, ease: "sine.inOut", delay: i * 0.15 });
    });
    var art = document.querySelector(".ph-art");
    if (art && fine) window.addEventListener("pointermove", function (e) {
      var dx = e.clientX / window.innerWidth - 0.5, dy = e.clientY / window.innerHeight - 0.5;
      gsap.to(art, { x: dx * -18, y: dy * -12, duration: 0.8, ease: "power2.out", overwrite: "auto" });
    }, { passive: true });
    var giant = document.querySelector(".foot-giant span");
    if (giant) gsap.fromTo(giant, { xPercent: -3 }, { xPercent: 3, duration: 9, yoyo: true, repeat: -1, ease: "sine.inOut" });
    document.querySelectorAll(".marquee-track").forEach(function (m) { m.addEventListener("pointerenter", function () { m.style.animationPlayState = "paused"; }); m.addEventListener("pointerleave", function () { m.style.animationPlayState = ""; }); });
  }

  /* ---------------- v5: richer motion (visibility, timers and pointer only) ---------------- */
  /* card headings: keep the icon on its own line and let the words flow normally */
  document.querySelectorAll(".card-fs > h3, .qlist > h3").forEach(function (h) {
    var ic = h.querySelector(".ic");
    if (!ic || ic.parentNode !== h || h.querySelector(".h3t")) return;
    var sp = document.createElement("span"); sp.className = "h3t";
    while (ic.nextSibling) sp.appendChild(ic.nextSibling);
    h.appendChild(sp);
  });
  if (hasGsap && !reduce && hasIO) {
    var rootEl = document.documentElement;
    rootEl.classList.add("fx5");

    /* 1. headings rise out of a mask, word by word */
    document.querySelectorAll(".page-body > h2, .page-pad > h2, .page-pad .reveal > h2, .page-pad .row h2, .hgal-head h2").forEach(function (h) {
      if (h.children.length || h.dataset.split) return;
      h.dataset.split = "1";
      h.innerHTML = h.textContent.trim().split(/\s+/).map(function (w) { return "<span class='mw'><span>" + w + "</span></span>"; }).join(" ");
      var inner = h.querySelectorAll(".mw > span");
      gsap.set(inner, { yPercent: 110 });
      onVisible(h, function () {
        h.classList.add("h-in");
        gsap.to(inner, { yPercent: 0, duration: .85, stagger: .055, ease: "power4.out", delay: h.tagName === "H1" ? .15 : 0 });
      }, "0px 0px -4% 0px");
    });

    /* 2. gold marker sweeps under the key words as they come into view */
    document.querySelectorAll(".page-body p strong, .keyband strong, .callout strong").forEach(function (st, i) {
      onVisible(st, function () { setTimeout(function () { st.classList.add("lit"); }, 250 + (i % 3) * 120); }, "0px 0px -12% 0px");
    });

    /* 3. key-point bands: a light sweep and a growing side bar */
    document.querySelectorAll(".keyband, .callout").forEach(function (k) {
      onVisible(k, function () { k.classList.add("lit"); }, "0px 0px -10% 0px");
    });

    /* 4. figures count up (the largest number in each figure, format kept) */
    document.querySelectorAll(".glance-item b, .stat b").forEach(function (b) {
      if (b.querySelector("[data-count]") || b.children.length) return;
      var txt = b.textContent, best = null, re = /\d[\d,]*(\.\d+)?/g, m;
      while ((m = re.exec(txt))) { var v = parseFloat(m[0].replace(/,/g, "")); if (!best || v > best.v) best = { v: v, i: m.index, s: m[0] }; }
      if (!best || best.v < 10) return;
      var dec = (best.s.split(".")[1] || "").length, comma = best.s.indexOf(",") > -1;
      var fmt = function (x) { return dec ? x.toFixed(dec) : (comma ? Math.round(x).toLocaleString("en-IN") : String(Math.round(x))); };
      b.innerHTML = "";
      b.appendChild(document.createTextNode(txt.slice(0, best.i)));
      var span = document.createElement("span"); span.className = "cnt"; span.textContent = fmt(0); b.appendChild(span);
      b.appendChild(document.createTextNode(txt.slice(best.i + best.s.length)));
      onVisible(b, function () { var o = { v: 0 }; gsap.to(o, { v: best.v, duration: 1.6, ease: "power3.out", onUpdate: function () { span.textContent = fmt(o.v); }, onComplete: function () { span.textContent = best.s; } }); }, "0px 0px -5% 0px");
    });

    /* 5. lists and table rows arrive one after another */
    document.querySelectorAll(".page-body > ul, .page-body > ol, .card-fs ul, .qlist ol, .qlist ul").forEach(function (l) {
      var items = l.querySelectorAll(":scope > li"); if (!items.length) return;
      onVisible(l, function () { gsap.fromTo(items, { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: .55, stagger: .07, ease: "power2.out", clearProps: "transform,opacity" }); }, "0px 0px -8% 0px");
    });
    document.querySelectorAll(".tbl-scroll tbody").forEach(function (tb) {
      var rows = tb.querySelectorAll("tr");
      onVisible(tb, function () { gsap.fromTo(rows, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .07, ease: "power2.out", clearProps: "transform,opacity" }); }, "0px 0px -8% 0px");
    });

    if (fine) {
      /* 6. cards tilt towards the pointer */
      var tiltSel = ".card-fs, .tile, .doc-card, .glance-item, .hgal-card, .type-card, .process-step, .stat";
      document.querySelectorAll(tiltSel).forEach(function (c) { c.classList.add("tlt"); });
      document.addEventListener("pointermove", function (e) {
        var c = e.target.closest ? e.target.closest(".tlt") : null;
        if (!c) return;
        var r = c.getBoundingClientRect(), amp = Math.min(7, 2600 / Math.max(r.width, 1));
        var px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        c.style.setProperty("--ry", (px * amp).toFixed(2) + "deg");
        c.style.setProperty("--rx", (-py * amp).toFixed(2) + "deg");
      }, { passive: true });
      document.addEventListener("pointerout", function (e) {
        var c = e.target.closest ? e.target.closest(".tlt") : null;
        if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); }
      }, { passive: true });

      /* 7. magnetic buttons lean towards the pointer */
      document.querySelectorAll(".btn-brand, .btn-navy, .btn-ghost, .story-btn, .rail-arrow").forEach(function (b) {
        b.classList.add("mag");
        b.addEventListener("pointermove", function (e) {
          var r = b.getBoundingClientRect();
          b.style.translate = (((e.clientX - r.left) / r.width - .5) * 10).toFixed(1) + "px " + (((e.clientY - r.top) / r.height - .5) * 8).toFixed(1) + "px";
        });
        b.addEventListener("pointerleave", function () { b.style.translate = ""; });
      });

      /* 8. a soft glow follows the pointer behind the page */
      var glow = document.createElement("div"); glow.className = "fx-glow"; glow.setAttribute("aria-hidden", "true");
      document.body.appendChild(glow);
      var gx = innerWidth / 2, gy = innerHeight / 3, tx = gx, ty = gy, gRun = false;
      var gLoop = function () {
        gx += (tx - gx) * .08; gy += (ty - gy) * .08;
        glow.style.transform = "translate3d(" + (gx - 300).toFixed(1) + "px," + (gy - 300).toFixed(1) + "px,0)";
        if (Math.abs(tx - gx) + Math.abs(ty - gy) > .5) requestAnimationFrame(gLoop); else gRun = false;
      };
      window.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; if (!gRun) { gRun = true; requestAnimationFrame(gLoop); } }, { passive: true });
    }
  }

  /* ---------------- cursor: liquid glass lens (v8) ----------------
     The lens is the cursor: a drop of glass that refracts what is under it,
     stretches with speed, settles round when still, swells and is pulled
     towards links and buttons, becomes a labelled pill over cards, squeezes
     when pressed. A small point marks the exact click position. */
  if (fine && !reduce) {
    try {
      var rootC = document.documentElement;
      var lens = document.createElement("div"); lens.className = "fx-cur"; lens.setAttribute("aria-hidden", "true");
      lens.innerHTML = '<span class="fx-cur-glass"></span><span class="fx-cur-shine"></span><b class="fx-cur-label"></b>';
      var dot = document.createElement("div"); dot.className = "fx-dot"; dot.setAttribute("aria-hidden", "true");
      document.body.appendChild(lens); document.body.appendChild(dot);
      rootC.classList.add("fx-cursor2");
      var shine = lens.querySelector(".fx-cur-shine"), clab = lens.querySelector(".fx-cur-label");
      var mx = -300, my = -300, cx = -300, cy = -300, cw = 38, chh = 38, tw = 38, th = 38, st = 1, ang = 0, crun = false, cpress = false, mag = null;
      var cloop = function () {
        var gx = mx, gy = my;
        if (mag) { var mr = mag.getBoundingClientRect(); gx = mx + ((mr.left + mr.width / 2) - mx) * .3; gy = my + ((mr.top + mr.height / 2) - my) * .3; }
        var dx = gx - cx, dy = gy - cy; cx += dx * .24; cy += dy * .24;
        var sp = Math.min(Math.sqrt(dx * dx + dy * dy), 140);
        if (sp > .6) ang = Math.atan2(dy, dx);
        st += ((1 + sp / 240) - st) * .22;
        var kk = cpress ? .84 : 1;
        cw += (tw * kk - cw) * .22; chh += (th * kk - chh) * .22;
        var pill = tw > th + 8;
        var sx = pill ? 1 : st, sy = pill ? 1 : 1 / Math.sqrt(st), ra = pill ? 0 : ang;
        lens.style.width = cw.toFixed(1) + "px"; lens.style.height = chh.toFixed(1) + "px";
        lens.style.transform = "translate3d(" + (cx - cw / 2).toFixed(1) + "px," + (cy - chh / 2).toFixed(1) + "px,0) rotate(" + ra.toFixed(3) + "rad) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
        shine.style.transform = "rotate(" + (-ra).toFixed(3) + "rad)";
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(tw - cw) + Math.abs(th - chh) + Math.abs(st - 1) > .06) requestAnimationFrame(cloop);
        else crun = false;
      };
      var ckick = function () { if (!crun) { crun = true; requestAnimationFrame(cloop); } };
      window.addEventListener("pointermove", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        mx = e.clientX; my = e.clientY;
        if (cx < -200) { cx = mx; cy = my; }
        dot.style.transform = "translate3d(" + (mx - 3) + "px," + (my - 3) + "px,0)";
        rootC.classList.add("fx-on");
        var t = e.target, c = function (sel) { return t && t.closest ? t.closest(sel) : null; };
        var field = c("input,textarea,select,[contenteditable],.chat-log");
        rootC.classList.toggle("fx-field", !!field);
        var lab = !field && c("[data-cursor],.hgal-card,.tile,.doc-card,.pager-link,.type-card");
        var hot = !field && !lab && c("a,button,.btn,[role=button],[data-term],label,summary,.story-label,.story-btn,.rail-arrow,.rail-dot,.accordion-button,.nav-link,.dropdown-item");
        var dark = !!c(".keyband,.fearon-band,.connect,.site-footer,.live-feed,.reg-side,.draft-ribbon,.fs-door,.curtain");
        var word = lab ? (lab.getAttribute("data-cursor") || (lab.classList.contains("pager-link") ? "Next" : "Open")) : "";
        if (clab.textContent !== word) clab.textContent = word;
        if (lab) { tw = 104; th = 46; } else if (hot) { tw = th = 60; } else { tw = th = 38; }
        mag = hot && hot.getBoundingClientRect().width < 280 ? hot : null;
        lens.className = "fx-cur" + (hot ? " hot" : "") + (lab ? " lab" : "") + (dark ? " dark" : "") + (cpress ? " press" : "");
        dot.className = "fx-dot" + (lab ? " off" : "") + (dark ? " light" : "");
        ckick();
      }, { passive: true });
      document.addEventListener("pointerdown", function () { cpress = true; lens.classList.add("press"); ckick(); });
      document.addEventListener("pointerup", function () { cpress = false; lens.classList.remove("press"); ckick(); });
      rootC.addEventListener("mouseleave", function () { rootC.classList.remove("fx-on"); });
      window.addEventListener("blur", function () { rootC.classList.remove("fx-on"); });
    } catch (e) { document.documentElement.classList.remove("fx-cursor2"); }
  }


  /* ================= v7: immersive layer =================
     Everything is driven by the pointer, visibility and a single scroll
     listener that only does work inside requestAnimationFrame. */
  (function () {
    if (reduce) return;
    var d = document.documentElement;

    /* 1. click ripple: every press leaves a soft gold and teal ring */
    document.addEventListener("pointerdown", function (e) {
      if (e.button && e.button !== 0) return;
      var r = document.createElement("span"); r.className = "fx-ripple";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      if (e.target.closest && e.target.closest(".keyband,.fearon-band,.connect,.site-footer,.reg-side,.hero")) r.classList.add("gold");
      document.body.appendChild(r);
      setTimeout(function () { r.remove(); }, 900);
    }, { passive: true });

    /* 2. hero headline: words lean towards the pointer */
    var hh = document.querySelector(".hero h1, .page-head h1");
    if (hh && fine) {
      var near = function (e) {
        var ws = hh.querySelectorAll(".mw");
        if (!ws.length) return;
        ws.forEach(function (w) {
          var r = w.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          var dx = e.clientX - cx, dy = e.clientY - cy, dist = Math.sqrt(dx * dx + dy * dy), f = Math.max(0, 1 - dist / 260);
          w.style.translate = (dx * f * .06).toFixed(1) + "px " + (-10 * f + dy * f * .04).toFixed(1) + "px";
          w.style.color = f > .35 ? "var(--fs-teal-deep)" : "";
        });
      };
      var heroBox = hh.closest(".hero, .page-head");
      heroBox.addEventListener("pointermove", near, { passive: true });
      heroBox.addEventListener("pointerleave", function () { hh.querySelectorAll(".mw").forEach(function (w) { w.style.translate = ""; w.style.color = ""; }); });
    }

    /* 3. one scroll loop: parallax depth, marquee speed, header shrink, back-to-top ring */
    var marq = [].slice.call(document.querySelectorAll(".marquee-track"));
    var par = [].slice.call(document.querySelectorAll(".ph-art, .ph-orb, .hero .orb, .hero-lines, .hero-orbs, .kb-orb"));
    var headInner = null;
    var header = document.querySelector(".site-header");
    var topBtn = document.createElement("button");
    topBtn.type = "button"; topBtn.className = "fx-top"; topBtn.setAttribute("aria-label", "Back to top");
    topBtn.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="trk" cx="24" cy="24" r="21"/><circle class="bar" cx="24" cy="24" r="21"/><path d="M24 31V17M17.5 23.5 24 17l6.5 6.5"/></svg>';
    document.body.appendChild(topBtn);
    topBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    var ring = topBtn.querySelector(".bar"), CIRC = 2 * Math.PI * 21;
    ring.style.strokeDasharray = CIRC;
    var lastY = window.scrollY, vel = 0, ticking = false, parked = false, docH = 0, lastP = -1;
    var measure = function () { docH = d.scrollHeight - window.innerHeight; };
    measure(); window.addEventListener("resize", measure); window.addEventListener("load", measure); setInterval(measure, 2000);
    par.concat(headInner ? [headInner] : []).forEach(function (el) { el.style.willChange = "translate, opacity"; });
    var tick = function () {
      ticking = false;
      var y = window.scrollY, h = docH, p = h > 0 ? Math.min(1, y / h) : 0;
      vel += ((y - lastY) - vel) * .25; lastY = y;
      if (y < 1100 || !parked) {
        parked = y >= 1100;
        var yy = Math.min(y, 1100);
        par.forEach(function (el, i) { el.style.translate = "0 " + (yy * (.08 + (i % 3) * .05)).toFixed(1) + "px"; });
        if (headInner) { headInner.style.opacity = Math.max(.25, 1 - yy / 700).toFixed(3); headInner.style.translate = "0 " + (yy * .18).toFixed(1) + "px"; }
      }
      if (header) header.classList.toggle("fx-compact", y > 80);
      if (Math.abs(p - lastP) > .004) { lastP = p; ring.style.strokeDashoffset = (CIRC * (1 - p)).toFixed(1); }
      topBtn.classList.toggle("on", y > 600);
      var boost = Math.min(4, Math.abs(vel) / 14);
      marq.forEach(function (m) {
        var an = m.getAnimations ? m.getAnimations()[0] : null;
        if (an) an.playbackRate = (vel < -1 ? -1 : 1) * (1 + boost);
        if (m.parentElement) m.parentElement.style.transform = "skewX(" + Math.max(-8, Math.min(8, -vel * .25)).toFixed(2) + "deg)";
      });
      if (Math.abs(vel) > .3) { ticking = true; requestAnimationFrame(tick); }
    };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }, { passive: true });
    tick();

    /* 4. bands open like a curtain the first time they come into view */
    var wipes = [].slice.call(document.querySelectorAll(".keyband, .fearon-band, .connect, .callout, .review-block, .stat-band"));
    wipes.forEach(function (b) { b.classList.add("fx-wipe"); });
    var checkWipes = function () {
      if (!wipes.length) return;
      var vh = window.innerHeight;
      wipes = wipes.filter(function (b) {
        var r = b.getBoundingClientRect();
        if (r.top < vh * .92 && r.bottom > 0) {
          b.classList.add("fx-wiped");
          setTimeout(function () { b.classList.remove("fx-wipe", "fx-wiped"); }, 1300);
          return false;
        }
        return true;
      });
    };
    window.addEventListener("scroll", function () { requestAnimationFrame(checkWipes); }, { passive: true });
    setTimeout(checkWipes, 200);
    var wipeTimer = setInterval(function () { checkWipes(); if (!wipes.length) clearInterval(wipeTimer); }, 800);

    /* 5. navigation: a gold line glides to whichever item the pointer is on */
    var navUl = document.querySelector(".site-header .navbar-nav");
    if (navUl && fine) {
      var line = document.createElement("span"); line.className = "fx-navline"; navUl.appendChild(line);
      var moveTo = function (a) {
        if (!a) { line.style.opacity = 0; return; }
        var r = a.getBoundingClientRect(), pr = navUl.getBoundingClientRect();
        line.style.opacity = 1; line.style.width = r.width - 20 + "px";
        line.style.transform = "translateX(" + (r.left - pr.left + 10).toFixed(1) + "px)";
      };
      navUl.querySelectorAll(".nav-link").forEach(function (a) { a.addEventListener("pointerenter", function () { moveTo(a); }); });
      navUl.addEventListener("pointerleave", function () { moveTo(navUl.querySelector(".nav-link.active")); });
      setTimeout(function () { moveTo(navUl.querySelector(".nav-link.active")); }, 400);
    }

    /* 6. text that is pointed at lights up: glance numbers and stats glow under the pointer */
    document.querySelectorAll(".glance-item, .stat, .keyband, .fearon-band, .connect").forEach(function (el) {
      el.classList.add("fx-gl"); var g = document.createElement("span"); g.className = "fx-glin"; g.setAttribute("aria-hidden", "true"); el.appendChild(g);
    });
    if (fine) document.addEventListener("pointermove", function (e) {
      var c = e.target.closest ? e.target.closest(".fx-gl") : null;
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      c.style.setProperty("--gy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });

    /* 7. long pages: a chapter line on the left fills as you read */
    var body = document.querySelector(".page-body");
    if (body && body.offsetHeight > window.innerHeight * 1.4) {
      var rail = document.createElement("div"); rail.className = "fx-read"; rail.innerHTML = "<i></i>";
      document.body.appendChild(rail);
      var fillR = rail.firstChild, readTick = false;
      var upd = function () {
        readTick = false;
        var r = body.getBoundingClientRect(), tot = r.height - window.innerHeight * .5;
        var p = Math.max(0, Math.min(1, (-r.top + window.innerHeight * .3) / tot));
        fillR.style.transform = "scaleY(" + p.toFixed(3) + ")";
        rail.classList.toggle("on", r.top < window.innerHeight * .5 && r.bottom > window.innerHeight * .4);
      };
      window.addEventListener("scroll", function () { if (!readTick) { readTick = true; requestAnimationFrame(upd); } }, { passive: true });
      upd();
    }

    /* 8. page change: the curtain carries the First Signs mark */
    var cur = document.getElementById("curtain");
    if (cur && !cur.querySelector(".fx-cmark")) {
      cur.innerHTML = '<span class="fx-cmark"><svg viewBox="0 0 44 44" aria-hidden="true"><rect x="1" y="1" width="42" height="42" rx="10" fill="#0F2E52" stroke="#3E6E8E"/><path d="M9 29.5 Q 22 21.5 35 29.5" fill="none" stroke="#7FB6C6" stroke-width="2.2" stroke-linecap="round"/><path d="M9 34 Q 22 27.5 35 34" fill="none" stroke="#3E6E8E" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/><circle cx="22" cy="16.5" r="4.6" fill="#E8B84B"/></svg>First Signs</span>';
    }
  })();


  /* ================= v8: decoding labels ================= */
  (function () {
    if (reduce || !hasIO) return;
    var CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    document.querySelectorAll(".eyebrow, .kb-eyebrow, .review-label, .pager-eyebrow, .rail-label").forEach(function (el) {
      if (el.children.length) return;
      var fin = el.textContent; if (!fin.trim() || fin.length > 70) return;
      onVisible(el, function () {
        var t0 = performance.now(), D = 650 + fin.length * 12;
        el.style.minWidth = el.offsetWidth + "px";
        var f = function (t) {
          var q = Math.min(1, (t - t0) / D), n = Math.floor(q * fin.length);
          el.textContent = fin.slice(0, n) + fin.slice(n).replace(/[A-Za-z]/g, function () { return CH[(Math.random() * 26) | 0]; });
          if (q < 1) requestAnimationFrame(f); else { el.textContent = fin; el.style.minWidth = ""; }
        };
        requestAnimationFrame(f);
      }, "0px 0px -6% 0px");
    });
  })();

  /* ---------------- page transitions ---------------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(https?:|mailto:|tel:)/.test(href) || !/\.html(#.*)?$/.test(href)) return;
    e.preventDefault();
    if (curtain && hasGsap && !reduce) {
      gsap.to(curtain, { scaleY: 1, transformOrigin: "bottom", duration: .3, ease: "power3.inOut", onComplete: function () { window.location.href = href; } });
    } else {
      document.body.classList.add("leaving");
      setTimeout(function () { window.location.href = href; }, 200);
    }
  });
  if (curtain && hasGsap && !reduce && seenIntro) {
    gsap.set(curtain, { scaleY: 1, transformOrigin: "top" });
    gsap.to(curtain, { scaleY: 0, duration: .6, ease: "power4.inOut", delay: .05 });
  } else if (curtain && hasGsap) { gsap.set(curtain, { scaleY: 0 }); }
})();
