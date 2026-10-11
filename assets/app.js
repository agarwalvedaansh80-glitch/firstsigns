/* First Signs v2 runtime.
   Shared state (registrations, chat, discussions) lives in the artifact's
   database when available, so every visitor sees the same community and the
   admin sees every registration. When the database is not available in a
   view, the page falls back to a browser-only preview and says so.
   A real backend replaces the FS.data layer at publication without
   redesigning any page. */
(function () {
  "use strict";
  var PREFIX = document.body.getAttribute("data-prefix") || "";

  /* ---------- safe local storage (per-browser conveniences only) ---------- */
  var mem = {};
  var store = {
    get: function (k) {
      try { var v = window.localStorage.getItem("fs_" + k); if (v !== null) return JSON.parse(v); } catch (e) {}
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    set: function (k, v) {
      mem[k] = v;
      try { window.localStorage.setItem("fs_" + k, JSON.stringify(v)); } catch (e) {}
    },
    del: function (k) {
      delete mem[k];
      try { window.localStorage.removeItem("fs_" + k); } catch (e) {}
    }
  };

  /* ---------- capabilities ---------- */
  var cap = { db: null, user: null, uid: null, isAdmin: false, ready: null };
  cap.ready = (async function () {
    try {
      if (window.claude && typeof window.claude.use === "function") {
        var results = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
        cap.db = results[0] || null;
        cap.user = results[1] || null;
        if (cap.user) {
          try { cap.uid = await cap.user.id(); } catch (e) { cap.uid = null; }
          try { cap.isAdmin = !!(cap.user.isOwner() || cap.user.canEdit()); } catch (e) { cap.isAdmin = false; }
        }
      }
    } catch (e) { /* run in preview mode */ }
    return cap;
  })();

  function toast(msg) {
    var t = document.createElement("div");
    t.setAttribute("role", "status");
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#0F2E52;color:#fff;padding:11px 22px;border-radius:8px;font-size:.88rem;z-index:3000;max-width:88vw;box-shadow:0 8px 24px rgba(0,0,0,.28)";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4600);
  }

  /* keep typed text and focus when a live list re-renders */
  function keepDrafts(root, fn) {
    var vals = {}, act = document.activeElement, actId = act && root.contains(act) ? act.id : null, sel = null;
    root.querySelectorAll("input[id],textarea[id]").forEach(function (i) { vals[i.id] = i.value; });
    if (actId) { try { sel = [act.selectionStart, act.selectionEnd]; } catch (e) {} }
    fn();
    Object.keys(vals).forEach(function (id) { var i = document.getElementById(id); if (i && vals[id]) i.value = vals[id]; });
    if (actId) { var a = document.getElementById(actId); if (a) { a.focus({ preventScroll: true }); if (sel) try { a.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function me() { return store.get("me"); }

  window.FS = {
    store: store, toast: toast, cap: cap, me: me,
    printPage: function () {
      try { window.print(); } catch (e) {}
      toast("If the print dialog does not open in this preview, use your browser or app menu to print. On the published site this button prints directly.");
    },
    openRegister: function () { openPanel(); },
    closeRegister: function () { closePanel(); }
  };

  /* every page opens at the top (unless the link points to a section) */
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
  if (!location.hash) {
    /* also bring the frame itself to the top when the site is shown inside
       another page (the artifact viewer), so a new page never opens at the bottom */
    var toTop = function () {
      try { window.scrollTo(0, 0); } catch (e) {}
      try { document.documentElement.scrollIntoView({ block: "start", inline: "nearest" }); } catch (e) {}
    };
    toTop();
    document.addEventListener("DOMContentLoaded", toTop);
    window.addEventListener("load", function () { toTop(); setTimeout(toTop, 150); });
    window.addEventListener("pageshow", function (e) { if (e.persisted) toTop(); });
  }

  /* ---------- registration panel (covers the page until they register or continue as guest) ---------- */
  var panel = document.getElementById("regPanel");
  var backdrop = document.getElementById("regBackdrop");
  var lastFocus = null;
  function openPanel() {
    if (!panel) return;
    lastFocus = document.activeElement;
    personalisePanel();
    panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    if (backdrop) backdrop.classList.add("open");
    document.documentElement.classList.add("reg-lock");
    var first = panel.querySelector("input"); if (first && window.matchMedia("(min-width: 768px)").matches) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 400);
  }
  function closePanel(asGuest) {
    if (!panel) return;
    panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true");
    if (backdrop) backdrop.classList.remove("open");
    document.documentElement.classList.remove("reg-lock");
    if (asGuest && !me()) { try { window.sessionStorage.setItem("fs_guest", "1"); } catch (e) {} }
    if (!location.hash) { try { window.scrollTo(0, 0); } catch (e) {} }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* keep keyboard focus inside the dialog while it is open */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !panel || !panel.classList.contains("open")) return;
    var f = panel.querySelectorAll("input,select,button,a[href]"); if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
  document.querySelectorAll("[data-reg-open]").forEach(function (b) { b.addEventListener("click", function () { if (me()) { window.location.href = PREFIX + "about/dashboard.html"; } else openPanel(); }); });
  document.querySelectorAll("[data-reg-close]").forEach(function (b) { b.addEventListener("click", function () { closePanel(true); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel(true); });

  /* ---------- header shadow, scroll progress, parallax ---------- */
  var header = document.getElementById("siteHeader");
  var fill = document.getElementById("scrollbarFill");
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var plax = Array.prototype.slice.call(document.querySelectorAll("[data-depth]"));
  var onScroll = function () {
    var y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 6);
    if (fill) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.width = (h > 0 ? Math.min(100, y / h * 100) : 0) + "%";
    }
    if (!reduceMotion) plax.forEach(function (el) {
      var d = parseFloat(el.getAttribute("data-depth")) || 0;
      el.style.transform = "translate3d(0," + (y * d).toFixed(1) + "px,0)";
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* gentle pointer depth on the hero */
  var hero = document.querySelector(".hero");
  if (hero && !reduceMotion && window.matchMedia("(pointer:fine)").matches) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      hero.querySelectorAll("[data-float]").forEach(function (el) {
        var f = parseFloat(el.getAttribute("data-float")) || 8;
        el.style.translate = (dx * f).toFixed(1) + "px " + (dy * f).toFixed(1) + "px";
      });
    });
  }

  /* 3D tilt micro-effect on tiles and cards */
  if (!reduceMotion && window.matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll(".tile, .type-card, .doc-featured, .stat").forEach(function (card) {
      card.classList.add("tiltable");
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
        card.style.transform = "perspective(700px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-3px)";
      });
      card.addEventListener("pointerleave", function () { card.style.transform = ""; });
    });
  }

  /* dashboard registrations anchor */
  if (window.location.hash === "#registrations") {
    setTimeout(function () {
      var el = document.getElementById("admin-regs");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 600);
  }

  /* ---------- staggered reveal on scroll (transform only; content always visible) ----------
     Only elements BELOW the fold at load are tagged, so the first frame is complete. */
  (function () {
    var candidates = document.querySelectorAll(".reveal, .card-fs, .tile, .type-card, .doc-card, .thread, .qlist, .stat, .prof-field, .accordion-item");
    var toWatch = [];
    if (!reduceMotion) candidates.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.92) { el.classList.add("reveal"); toWatch.push(el); }
      else el.classList.add("in");
    });
    else candidates.forEach(function (el) { el.classList.add("in"); });
    try {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var el = en.target;
            var sibs = toWatch.filter(function (x) { return x.parentElement === el.parentElement; });
            var idx = Math.max(0, sibs.indexOf(el));
            el.style.transitionDelay = Math.min(idx * 70, 280) + "ms";
            el.classList.add("in");
            io.unobserve(el);
          }
        });
      }, { rootMargin: "0px 0px -6% 0px" });
      toWatch.forEach(function (el) { io.observe(el); });
    } catch (e) { toWatch.forEach(function (el) { el.classList.add("in"); }); }
  })();

  /* ---------- copy contact details ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      var v = b.getAttribute("data-copy");
      var done = function () { b.textContent = "Copied"; b.classList.add("done"); setTimeout(function () { b.textContent = "Copy"; b.classList.remove("done"); }, 1600); };
      var fallback = function () { var t = document.createElement("textarea"); t.value = v; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (y) { toast(v); } t.remove(); };
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, fallback); else fallback(); } catch (x) { fallback(); }
    });
  });

  /* ---------- WhatsApp share ---------- */
  document.querySelectorAll("[data-wa]").forEach(function (a) {
    var text = a.getAttribute("data-wa") + " (draft preview; link available after the site is published)";
    a.href = "https://wa.me/?text=" + encodeURIComponent(text);
    a.target = "_blank";
  });

  /* ---------- glossary tooltips ---------- */
  var GLOSS = window.FS_GLOSSARY || [];
  var gmap = {};
  GLOSS.forEach(function (g) { gmap[g.term.toLowerCase()] = g.def; });
  /* one shared popover: anchored on laptops, bottom sheet on phones */
  var gPop = null, gFor = null, gHold = false;
  function isSheet() { return window.innerWidth <= 640 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches); }
  function hideGloss() { if (gPop) { gPop.remove(); gPop = null; gFor = null; gHold = false; } }
  function placeGloss() {
    if (!gPop || !gFor) return;
    if (isSheet()) return; /* CSS pins the sheet */
    var r = gFor.getBoundingClientRect(), pw = gPop.offsetWidth, phh = gPop.offsetHeight;
    var left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
    var top = r.bottom + 10, up = false;
    if (top + phh > window.innerHeight - 12 && r.top - phh - 10 > 70) { top = r.top - phh - 10; up = true; }
    gPop.classList.toggle("up", up);
    gPop.style.left = left + "px"; gPop.style.top = top + "px";
    gPop.style.setProperty("--ax", Math.max(14, Math.min(pw - 20, r.left + Math.min(r.width, 60) / 2 - left)) + "px");
    if (r.bottom < 60 || r.top > window.innerHeight) hideGloss();
  }
  function showGloss(el, hold) {
    var key = (el.getAttribute("data-term") || el.textContent).toLowerCase();
    var def = gmap[key]; if (!def) return;
    if (gFor === el && gPop) { if (hold) gHold = true; return; } /* no re-create, no jump */
    hideGloss();
    gPop = document.createElement("div");
    gPop.className = "gloss-pop" + (isSheet() ? " sheet" : "");
    gPop.setAttribute("role", "dialog");
    gPop.setAttribute("aria-label", "Definition of " + el.textContent);
    gPop.innerHTML = '<button type="button" class="gloss-x" aria-label="Close definition">&times;</button><span class="gloss-k">Glossary</span><b>' + esc(el.textContent) + ".</b> " + esc(def) +
      '<a class="gloss-more" href="' + (document.querySelector('a[href$="glossary.html"]') ? document.querySelector('a[href$="glossary.html"]').getAttribute("href") : "#") + '">Full glossary &rarr;</a>';
    document.body.appendChild(gPop);
    gFor = el; gHold = !!hold;
    gPop.querySelector(".gloss-x").addEventListener("click", function (e) { e.stopPropagation(); hideGloss(); });
    gPop.addEventListener("pointerenter", function () { gHold = true; });
    gPop.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { gHold = false; setTimeout(function () { if (!gHold) hideGloss(); }, 150); } });
    placeGloss();
  }
  document.querySelectorAll("[data-term]").forEach(function (el) {
    el.classList.add("gloss-term");
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" && !isSheet()) showGloss(el, false); });
    el.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") setTimeout(function () { if (!gHold && gFor === el) hideGloss(); }, 180); });
    el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); showGloss(el, true); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showGloss(el, true); } });
  });
  document.addEventListener("click", function (e) { if (gPop && !e.target.closest(".gloss-pop,[data-term]")) hideGloss(); });
  window.addEventListener("scroll", function () { if (gPop && !isSheet()) placeGloss(); }, { passive: true });
  window.addEventListener("resize", function () { if (gPop) placeGloss(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideGloss(); });

  /* ---------- registration ---------- */
  function refreshAuthUI() {
    var m = me();
    document.querySelectorAll("[data-auth-slot]").forEach(function (b) {
      if (m) {
        b.textContent = m.name.split(" ")[0];
      } else {
        b.textContent = "Register / sign in";
      }
    });
  }

  async function saveRegistration(rec) {
    await cap.ready;
    rec.ts = Date.now();
    rec.date = new Date().toISOString().slice(0, 10);
    if (cap.db && cap.uid) {
      try {
        await cap.db.doc("regs/" + cap.uid).set(rec);
        return "db";
      } catch (e) { /* fall through to local */ }
    }
    var local = store.get("local_regs") || [];
    local.push(rec); store.set("local_regs", local);
    return "local";
  }

  document.querySelectorAll("[data-reg-form]").forEach(function (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = form.querySelector("[name=name]").value.trim();
      var email = form.querySelector("[name=email]").value.trim();
      var role = form.querySelector("[name=role]").value;
      var cityEl = form.querySelector("[name=city]");
      var city = cityEl ? cityEl.value.trim() : "";
      var consent = form.querySelector("input[type=checkbox]");
      if (!name) { toast("Please enter your name."); return; }
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("A valid email is required to register."); return; }
      if (consent && !consent.checked) { toast("The consent box is required, so you always know what is stored."); return; }
      var rec = { name: name, email: email, role: role, city: city };
      var where = await saveRegistration(rec);
      store.set("me", rec);
      refreshAuthUI();
      closePanel(false);
      if (where === "db") toast("Registered. Welcome to First Signs, " + name.split(" ")[0] + ". Your registration is saved.");
      else toast("Registered in this browser's preview only; the shared member list is unavailable in this view. On the published site this saves centrally.");
      renderDash(); renderCommunity && renderCommunity();
    });
  });

  /* pre-fills the panel for registered people who open it themselves */
  function personalisePanel() {
    if (!panel) return;
    var m = me();
    var title = panel.querySelector(".regpanel-title"), sub = panel.querySelector(".regpanel-sub");
    var submit = panel.querySelector("button[type=submit]"), guest = panel.querySelector(".reg-guest");
    if (m) {
      if (title) title.textContent = "Welcome back, " + String(m.name || "").split(" ")[0];
      if (sub) sub.textContent = "You are registered with First Signs. Check your details below and update them if anything has changed.";
      if (submit) submit.textContent = "Save details";
      if (guest) guest.textContent = "Continue to the site";
      [["name", m.name], ["email", m.email], ["city", m.city]].forEach(function (f) { var i = panel.querySelector("[name=" + f[0] + "]"); if (i && f[1]) i.value = f[1]; });
      var r = panel.querySelector("[name=role]"); if (r && m.role) r.value = m.role;
      var c = panel.querySelector("input[type=checkbox]"); if (c) c.checked = true;
    }
  }
  (function () {
    var root = document.documentElement;
    /* registered once = never asked again; everyone else sees it first,
       on every page they open, every time.
       It opens at once, with no wait: a small script in the page head has
       already drawn it before the page appears. */
    var show = !me();
    if (show) {
      openPanel();
      var dropInstant = function () { root.classList.remove("reg-instant"); };
      requestAnimationFrame(dropInstant); setTimeout(dropInstant, 120);
    } else {
      root.classList.remove("reg-instant");
    }
    /* someone registered on another device: recognise them and close it quietly */
    Promise.resolve(cap.ready).then(async function () {
      if (me() || !cap.db || !cap.uid) return;
      try {
        var snap = await cap.db.doc("regs/" + cap.uid).get();
        var d = snap && (typeof snap.data === "function" ? snap.data() : snap);
        if (d && d.email) {
          store.set("me", { name: d.name, email: d.email, role: d.role, city: d.city || "" }); refreshAuthUI();
          if (panel && panel.classList.contains("open")) closePanel(false);
        }
      } catch (e) {}
    });
  })();

  /* ---------- search page ---------- */
  var resBox = document.getElementById("search-results");
  if (resBox && window.FS_SEARCH) {
    var params = new URLSearchParams(window.location.search);
    var q = (params.get("q") || "").trim();
    var input = document.getElementById("search-input");
    if (input) input.value = q;
    var run = function (query) {
      var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) { resBox.innerHTML = "<p>Type a word above, for example <em>helmet</em>, <em>swelling</em>, <em>PM-JAY</em> or <em>cost</em>.</p>"; return; }
      var scored = [];
      window.FS_SEARCH.forEach(function (pg) {
        var score = 0;
        terms.forEach(function (t) {
          if (pg.t.toLowerCase().indexOf(t) !== -1) score += 6;
          if (pg.d.toLowerCase().indexOf(t) !== -1) score += 3;
          var n = pg.x.split(t).length - 1; score += Math.min(n, 5);
        });
        if (score > 0) scored.push([score, pg]);
      });
      scored.sort(function (a, b) { return b[0] - a[0]; });
      if (!scored.length) { resBox.innerHTML = "<p>No pages matched. Try a simpler word, or browse from the menu above.</p>"; return; }
      resBox.innerHTML = "<ul class='search-results list-unstyled'>" + scored.slice(0, 12).map(function (s) {
        var pg = s[1];
        return "<li><a href='" + PREFIX + pg.p + "'><strong>" + esc(pg.t) + "</strong></a><br><span>" + esc(pg.d) + "</span><br><span class='res-path'>" + esc(pg.p) + "</span></li>";
      }).join("") + "</ul>";
    };
    run(q);
    var form = document.getElementById("search-form");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); run(input.value); });
  }

  /* ---------- community: one common live chat ---------- */
  var chatRoot = document.getElementById("chat-root");
  var threadsRoot = document.getElementById("threads-root");
  var unsubChat = null, unsubThreads = null;
  var renderCommunity = null;

  function identityGate(actionLabel) {
    var m = me();
    if (m) return m;
    toast("Please register first (name and email) to " + actionLabel + ". Opening the registration form.");
    FS.openRegister();
    return null;
  }

  function roleBadge(m) {
    if (!m) return "";
    if (m.role === "doctor") return ' <span class="badge-fs badge-tbc">Doctor (verification pending)</span>';
    if (m.team) return ' <span class="badge-fs badge-lead">First Signs team</span>';
    if (m.verified) return ' <span class="badge-fs badge-verified">Verified Doctor</span>';
    return "";
  }

  if (chatRoot) {
    var chatMode = "connecting"; // db | local
    var localMsgs = store.get("local_msgs_main") || [];

    var renderChat = function (msgs) { keepDrafts(chatRoot, function () { renderChatInner(msgs); }); };
    var renderChatInner = function (msgs) {
      var status = chatMode === "db"
        ? "Live: one common room, every message visible to everyone who opens the site"
        : (chatMode === "local" ? "Browser-only preview: the shared room is unavailable in this view" : "Connecting to the community room&hellip;");
      var mine = me();
      var list = msgs.map(function (msg) {
        var isMine = mine && msg.email && mine.email === msg.email;
        var docLabel = msg.role === "doctor" ? "<span class='reply-label'>General information, not a medical consultation</span>" : "";
        var sample = msg.sample ? " <span class='badge-fs badge-sample'>Sample</span>" : "";
        return "<div class='msg" + (isMine ? " mine" : "") + "'><div class='msg-head'><b>" + esc(msg.name || "Member") + "</b>" +
          roleBadge(msg) + sample + " &middot; " + (msg.ts ? new Date(msg.ts).toLocaleString() : "") +
          "<button class='report-btn' data-report>Report</button></div>" +
          "<div class='msg-body'>" + esc(msg.text) + docLabel + "</div></div>";
      }).join("") || "<p class='attr'>No messages yet. Say hello.</p>";
      chatRoot.innerHTML =
        "<div class='chat-shell'><div class='chat-panel'>" +
        "<div class='chat-head'><h3>Community room</h3><span class='chat-status'>" + status + "</span></div>" +
        "<div class='chat-log' id='chat-log' aria-live='polite'>" + list + "</div>" +
        "<div class='chat-compose'>" +
        "<label class='visually-hidden' for='chat-input'>Message</label>" +
        "<input class='form-control' id='chat-input' maxlength='800' placeholder='Write a message&hellip; (no identifiable child photos, scans or records)'>" +
        "<button class='btn btn-brand' id='chat-send' type='button'>Send</button>" +
        "</div></div></div>";
      var log = document.getElementById("chat-log");
      if (log) log.scrollTop = log.scrollHeight;
      chatRoot.querySelectorAll("[data-report]").forEach(function (b) {
        b.addEventListener("click", function () { toast("Thank you. On the live site this sends the message to the moderation queue."); });
      });
      var sendBtn = document.getElementById("chat-send");
      var inputEl = document.getElementById("chat-input");
      var send = async function () {
        var m = identityGate("chat with other members"); if (!m) return;
        var text = inputEl.value.trim(); if (!text) return;
        inputEl.value = "";
        var msg = { name: m.name, email: m.email, role: m.role || "parent", text: text, ts: Date.now() };
        if (chatMode === "db" && cap.db) {
          try { await cap.db.collection("chat/main/messages").add(msg); return; }
          catch (e) { toast("Could not send just now. Message kept in this browser instead."); }
        }
        localMsgs = localMsgs.concat([msg]);
        store.set("local_msgs_main", localMsgs);
        renderChat(localMsgs);
      };
      if (sendBtn) sendBtn.addEventListener("click", send);
      if (inputEl) inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); send(); } });
    };

    var startChat = function () {
      if (unsubChat) { unsubChat(); unsubChat = null; }
      if (chatMode === "db" && cap.db) {
        var q = cap.db.collection("chat/main/messages").orderBy("ts", "desc").limit(200);
        unsubChat = q.onSnapshot(function (snap) {
          var msgs = snap.docs.map(function (d) { return d.data(); }).filter(Boolean).reverse();
          renderChat(msgs);
        }, function (err) {
          chatMode = "local"; renderChat(localMsgs);
        });
      } else {
        renderChat(localMsgs);
      }
    };

    renderChat([]); // visible immediately
    cap.ready.then(function () {
      chatMode = cap.db ? "db" : "local";
      startChat();
    });
  }

  /* ---------- discussions (threads with replies) ---------- */
  if (threadsRoot) {
    var SAMPLES = (window.FS_FORUM && window.FS_FORUM.threads) || [];
    var localThreads = store.get("local_threads") || [];
    var threadMode = "connecting";
    var dbThreads = [];
    var openReplies = {};

    var renderThreads = function () { keepDrafts(threadsRoot, renderThreadsInner); };
    var renderThreadsInner = function () {
      var mine = me();
      var all = dbThreads.concat(threadMode === "db" ? [] : localThreads);
      var own = all.map(function (t) {
        var replies = (t.replies || []).map(function (r) {
          var label = r.role === "doctor" ? "<span class='reply-label'>General information, not a medical consultation</span>" : "";
          var cls = r.team ? "reply reply-team" : "reply";
          return "<div class='" + cls + "'><span class='reply-author'>" + esc(r.name) + "</span>" + roleBadge(r) +
            "<button class='report-btn' data-report>Report</button>" + label + "<p class='mb-0'>" + esc(r.text) + "</p></div>";
        }).join("");
        var replyBox = openReplies[t.id]
          ? "<div class='mt-2 d-flex gap-2'><input class='form-control form-control-sm' id='rep-" + t.id + "' maxlength='800' placeholder='Write a reply'><button class='btn btn-brand btn-sm' data-reply-send='" + t.id + "'>Reply</button></div>"
          : "<button class='btn btn-ghost btn-sm mt-2' data-reply-open='" + t.id + "'>Reply</button>";
        return "<article class='thread'><h3 class='thread-title'>" + esc(t.title) + "</h3>" +
          "<p class='thread-meta'>" + esc(t.name || t.author || "Member") + " &middot; " + (t.ts ? new Date(t.ts).toLocaleDateString() : esc(t.date || "")) +
          (t.held ? " <span class='badge-fs badge-tbc'>Held for moderation</span>" : "") +
          "<button class='report-btn' data-report>Report</button></p>" +
          "<p class='thread-body'>" + esc(t.body) + "</p>" + replies + replyBox + "</article>";
      }).join("");
      var sample = SAMPLES.map(function (t) {
        var replies = (t.replies || []).map(function (r) {
          var badge = r.badge ? " <span class='badge-fs badge-verified'>" + esc(r.badge) + "</span>" : "";
          var label = r.label ? "<span class='reply-label'>" + esc(r.label) + "</span>" : "";
          var cls = r.role === "team" ? "reply reply-team" : "reply";
          return "<div class='" + cls + "'><span class='reply-author'>" + esc(r.author) + "</span>" + badge + label + "<p class='mb-0'>" + esc(r.body) + "</p></div>";
        }).join("");
        return "<article class='thread'><h3 class='thread-title'>" + esc(t.title) + " <span class='badge-fs badge-sample'>Sample</span></h3>" +
          "<p class='thread-meta'>" + esc(t.author) + " &middot; sample content shown for preview</p>" +
          "<p class='thread-body'>" + esc(t.body) + "</p>" + replies + "</article>";
      }).join("");
      var status = threadMode === "db" ? "" :
        "<div class='note-banner demo mb-3'><strong>Browser-only preview:</strong> the shared discussion store is unavailable in this view, so new posts stay in this browser.</div>";
      threadsRoot.innerHTML =
        status +
        "<div class='card-fs mb-4'><h3>Start a discussion</h3>" +
        "<label class='form-label' for='th-title'>Title</label><input class='form-control mb-2' id='th-title' maxlength='140' placeholder='For example: Helmet fitting in Mumbai, where did you go?'>" +
        "<label class='form-label' for='th-body'>Your question</label><textarea class='form-control mb-2' id='th-body' rows='3' maxlength='2000' placeholder='Share your question. Please do not include identifiable child photos, scans or medical records.'></textarea>" +
        "<button class='btn btn-brand' id='th-send' type='button'>Post discussion</button>" +
        "<p class='form-note mt-2 mb-0'>New members' first posts are held for approval on the live site. Every doctor reply is labelled general information, not a medical consultation.</p></div>" +
        (own || "<p class='attr'>No member discussions yet.</p>") +
        "<h2 class='mt-4'>Sample discussions</h2><p class='attr'>Shown so the layout and safety rules can be reviewed; removed before publication.</p>" + sample;
      threadsRoot.querySelectorAll("[data-report]").forEach(function (b) {
        b.addEventListener("click", function () { toast("Thank you. On the live site this sends the post to the moderation queue."); });
      });
      threadsRoot.querySelectorAll("[data-reply-open]").forEach(function (b) {
        b.addEventListener("click", function () { openReplies[b.getAttribute("data-reply-open")] = true; renderThreads(); });
      });
      threadsRoot.querySelectorAll("[data-reply-send]").forEach(function (b) {
        b.addEventListener("click", async function () {
          var tid = b.getAttribute("data-reply-send");
          var m = identityGate("reply"); if (!m) return;
          var inp = document.getElementById("rep-" + tid);
          var text = inp.value.trim(); if (!text) return;
          var rep = { name: m.name, email: m.email, role: m.role || "parent", text: text, ts: Date.now() };
          if (threadMode === "db" && cap.db) {
            try { await cap.db.collection("threads/" + tid + "/replies").add(rep); openReplies[tid] = false; return; }
            catch (e) { toast("Could not post just now."); return; }
          }
          localThreads = localThreads.map(function (t) {
            if (t.id === tid) { t.replies = (t.replies || []).concat([rep]); }
            return t;
          });
          store.set("local_threads", localThreads);
          openReplies[tid] = false; renderThreads();
        });
      });
      var sendBtn = document.getElementById("th-send");
      if (sendBtn) sendBtn.addEventListener("click", async function () {
        var m = identityGate("start a discussion"); if (!m) return;
        var title = document.getElementById("th-title").value.trim();
        var body = document.getElementById("th-body").value.trim();
        if (!title || !body) { toast("Please add both a title and your question."); return; }
        var t = { title: title, body: body, name: m.name, email: m.email, role: m.role || "parent", ts: Date.now() };
        if (threadMode === "db" && cap.db) {
          try { await cap.db.collection("threads").add(t); toast("Posted. On the live site, a new member's first post is held for moderation before appearing publicly."); return; }
          catch (e) { toast("Could not post just now."); }
        }
        t.id = "l" + Date.now(); t.held = true; t.replies = [];
        localThreads.unshift(t); store.set("local_threads", localThreads);
        renderThreads();
      });
    };

    var replySubs = [];
    var subscribeThreads = function () {
      if (unsubThreads) { unsubThreads(); unsubThreads = null; }
      replySubs.forEach(function (u) { u(); }); replySubs = [];
      if (threadMode === "db" && cap.db) {
        unsubThreads = cap.db.collection("threads").orderBy("ts", "desc").limit(50).onSnapshot(function (snap) {
          dbThreads = snap.docs.map(function (d) { var x = d.data() || {}; x.id = d.id; x.replies = x.replies || []; return x; });
          renderThreads();
          replySubs.forEach(function (u) { u(); }); replySubs = [];
          dbThreads.forEach(function (t) {
            var u = cap.db.collection("threads/" + t.id + "/replies").orderBy("ts", "asc").limit(100).onSnapshot(function (rs) {
              t.replies = rs.docs.map(function (d) { return d.data(); });
              renderThreads();
            }, function () {});
            replySubs.push(u);
          });
        }, function () { threadMode = "local"; renderThreads(); });
      } else { renderThreads(); }
    };

    renderThreads();
    cap.ready.then(function () { threadMode = cap.db ? "db" : "local"; subscribeThreads(); });
    renderCommunity = renderThreads;
  }

  /* ---------- member dashboard ---------- */
  var dashRoot = document.getElementById("dash-root");
  function renderDash() {
    if (!dashRoot) return;
    var B = window.FS_BENEFITS;
    var m = me();
    var who = m
      ? "<p>Signed in as <strong>" + esc(m.name) + "</strong> (" + esc(m.role) + ", " + esc(m.email) + "). <button class='btn btn-ghost btn-sm' id='dash-signout'>Sign out on this device</button></p>"
      : "<div class='callout callout-note'><strong>You are viewing the dashboard as a guest.</strong> <button class='btn btn-brand btn-sm' onclick='FS.openRegister()'>Register</button> to see it as a member; everything stays visible in this draft for review.</div>";
    var cards = (B ? B.benefits : []).map(function (b) {
      return "<div class='col-md-6'><div class='card-fs benefit-card'><span class='badge-fs badge-tbc sample-tag'>Sample offer</span><h3>" + esc(b.partner) + "</h3>" +
        "<p class='mb-1'><strong>" + esc(b.offer) + "</strong></p><p class='attr mb-2'>" + esc(b.detail) + "</p>" +
        "<p class='attr mb-2'>" + esc(b.city) + "</p>" +
        "<button class='btn btn-ghost btn-sm' data-claim>Request this benefit</button></div></div>";
    }).join("");
    dashRoot.innerHTML = who +
      (B ? "<div class='callout callout-tbc'><strong>Sample figures.</strong> " + esc(B.note) + "</div>" : "") +
      "<h2>Your member benefits</h2><div class='row g-3'>" + cards + "</div>" +
      "<div id='admin-regs' class='mt-4'></div>";
    dashRoot.querySelectorAll("[data-claim]").forEach(function (b) {
      b.addEventListener("click", function () { toast("Demo: on the live site this sends a request to the First Signs member desk, which coordinates with the partner."); });
    });
    var so = document.getElementById("dash-signout");
    if (so) so.addEventListener("click", function () { store.del("me"); refreshAuthUI(); renderDash(); });
    renderAdminRegs();
  }

  async function renderAdminRegs() {
    var box = document.getElementById("admin-regs");
    if (!box) return;
    await cap.ready;
    if (!cap.isAdmin) {
      box.innerHTML = "<div class='callout callout-note'><strong>Registrations (admin only).</strong> The list of registered members, with names and emails, is visible here only to the site admin. Members and guests cannot open it.</div>";
      return;
    }
    var rows = [];
    if (cap.db) {
      try {
        var snap = await cap.db.collection("regs").orderBy("ts", "desc").limit(500).get();
        rows = snap.docs.map(function (d) { return d.data(); }).filter(Boolean);
      } catch (e) { /* leave empty */ }
    }
    var local = store.get("local_regs") || [];
    var localNote = local.length ? "<p class='attr'>Plus " + local.length + " registration(s) made in this browser while the shared store was unavailable.</p>" : "";
    var table = rows.length
      ? "<div class='table-responsive'><table class='table table-fs table-striped'><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>City</th><th>Date</th></tr></thead><tbody>" +
        rows.map(function (r) {
          return "<tr><td>" + esc(r.name) + "</td><td>" + esc(r.email) + "</td><td>" + esc(r.role) + "</td><td>" + esc(r.city || "") + "</td><td>" + esc(r.date || "") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : "<p class='attr'>No registrations in the shared store yet. Register through the welcome form to see the first row appear here.</p>";
    box.innerHTML = "<h2>Registrations <span class='badge-fs badge-lead'>Admin only</span></h2>" +
      "<p class='attr'>Every member who registers appears here with the name and email they gave. Visible only to the admin.</p>" +
      (rows.length ? "<button class='btn btn-ghost btn-sm mb-3' id='regs-csv' type='button'>Download as CSV</button>" : "") +
      table + localNote;
    var csvBtn = document.getElementById("regs-csv");
    if (csvBtn) csvBtn.addEventListener("click", function () {
      var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
      var csv = ["Name,Email,Role,City,Date"].concat(rows.map(function (r) { return [r.name, r.email, r.role, r.city, r.date].map(q).join(","); })).join("\n");
      try {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "first-signs-registrations.csv"; document.body.appendChild(a); a.click(); a.remove();
      } catch (e) { toast("Download is blocked in this view. Copy the table instead."); }
    });
  }
  renderDash();

  /* ---------- video placeholders ---------- */
  var vidRoot = document.getElementById("video-root");
  if (vidRoot && window.FS_VIDEOS) {
    vidRoot.innerHTML = window.FS_VIDEOS.map(function (v) {
      return "<div class='col-md-6'><div class='card-fs'><div class='vslot'><div class='play' aria-hidden='true'></div><small>Upload slot ready: your video drops in here without a layout change</small></div>" +
        "<h3>" + esc(v.title) + "</h3><p class='attr mb-1'>" + esc(v.desc) + "</p>" +
        "<p class='attr mb-0'>Planned length: " + esc(v.length) + "</p></div></div>";
    }).join("");
  }

  /* ---------- doctor panel city filter ---------- */
  var docGrid = document.getElementById("doc-network");
  var cityBar = document.getElementById("city-filter");
  if (docGrid && cityBar) {
    var cards2 = Array.prototype.slice.call(docGrid.querySelectorAll("[data-city]"));
    var cities = ["All"];
    cards2.forEach(function (c) {
      var city = c.getAttribute("data-city");
      if (cities.indexOf(city) === -1) cities.push(city);
    });
    cityBar.innerHTML = cities.map(function (c, i) {
      return "<button class='btn btn-ghost btn-sm' aria-pressed='" + (i === 0) + "' data-city-btn='" + esc(c) + "'>" + esc(c) + "</button>";
    }).join("");
    cityBar.querySelectorAll("[data-city-btn]").forEach(function (b) {
      b.addEventListener("click", function () {
        var sel = b.getAttribute("data-city-btn");
        cityBar.querySelectorAll("[data-city-btn]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        cards2.forEach(function (c) {
          c.closest(".col-md-6").style.display = (sel === "All" || c.getAttribute("data-city") === sel) ? "" : "none";
        });
      });
    });
  }

  /* ---------- live community teaser on the home page ---------- */
  var feed = document.getElementById("live-feed");
  if (feed) {
    cap.ready.then(function () {
      var body = feed.querySelector("p");
      if (!cap.db) { if (body) body.textContent = "Open the community to read and join the conversation."; return; }
      try {
        cap.db.collection("chat/main/messages").orderBy("ts", "desc").limit(3).onSnapshot(function (snap) {
          var msgs = snap.docs.map(function (d) { return d.data(); }).filter(Boolean).reverse();
          var html = msgs.length ? msgs.map(function (mm) {
            return "<div class='live-msg'><b>" + esc(mm.name || "Member") + "</b>" + esc(String(mm.text || "").slice(0, 140)) + (String(mm.text || "").length > 140 ? "\u2026" : "") + "</div>";
          }).join("") : "<p class='attr mb-0' style='color:#9DB2CB'>No messages yet. Be the first to say hello.</p>";
          feed.innerHTML = "<h3><span class='live-dot'></span>Live in the community room</h3>" + html +
            "<a class='btn btn-ghost btn-sm mt-2' style='border-color:#5E7EA0;color:#EAF1F8' href='" + PREFIX + "community/forum.html'>Open the room</a>";
        }, function () { if (body) body.textContent = "Open the community to read and join the conversation."; });
      } catch (e) { if (body) body.textContent = "Open the community to read and join the conversation."; }
    });
  }

  refreshAuthUI();
})();
