/* ============================================================
   PySOAR Prep — app logic
   Hash routes:  #/          home dashboard
                 #/m/<id>    lesson
                 #/q/<id>    quiz
   ============================================================ */

(() => {
  "use strict";

  const STORE_KEY = "pysoar-progress-v1";
  const view = document.getElementById("view");
  const nav = document.getElementById("nav");
  const sidebar = document.getElementById("sidebar");
  const toast = document.getElementById("toast");

  /* ---------------- progress store ---------------- */

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveProgress(p) { localStorage.setItem(STORE_KEY, JSON.stringify(p)); }

  let progress = loadProgress();

  function modState(id) {
    return progress[id] || { read: false, best: 0, total: COURSE.modules[id].quiz.length };
  }
  function setModState(id, patch) {
    progress[id] = { ...modState(id), ...patch };
    saveProgress(progress);
    renderNav();
    renderRing();
  }
  function isDone(id) {
    const s = modState(id);
    return s.total > 0 && s.best / s.total >= 0.8;
  }
  function modPct(id) {
    const s = modState(id);
    const quizPart = s.total ? (s.best / s.total) : 0;
    return (s.read ? 0.3 : 0) + 0.7 * quizPart;
  }

  /* ---------------- tiny helpers ---------------- */

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // inline markdown-lite: **bold** and `code` (input is escaped first)
  function md(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  /* ---------------- python syntax highlighter ---------------- */

  const PY_RULES = new RegExp(
    [
      /(#[^\n]*)/.source,                                            // 1 comment
      /("""[\s\S]*?"""|'''[\s\S]*?''')/.source,                      // 2 triple string
      /([rbf]*"(?:[^"\\\n]|\\.)*"|[rbf]*'(?:[^'\\\n]|\\.)*')/.source,// 3 string
      /(^[ \t]*@[\w.]+)/.source,                                     // 4 decorator
      /\b(def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|yield|lambda|global|nonlocal|pass|break|continue|async|await|del|assert)\b/.source, // 5 keyword
      /\b(self|cls)\b/.source,                                       // 6 self
      /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/.source,                        // 7 number
      /\b([A-Za-z_]\w*)(?=\()/.source,                               // 8 call
    ].join("|"),
    "gm"
  );

  function highlightPy(code) {
    // tokenize raw source, escape each piece as we emit it
    let out = "", last = 0;
    code.replace(PY_RULES, (m, com, tstr, str, dec, kw, slf, num, call, offset) => {
      out += esc(code.slice(last, offset));
      if      (com)  out += `<span class="tok-com">${esc(com)}</span>`;
      else if (tstr) out += `<span class="tok-str">${esc(tstr)}</span>`;
      else if (str)  out += `<span class="tok-str">${esc(str)}</span>`;
      else if (dec)  out += `<span class="tok-dec">${esc(dec)}</span>`;
      else if (kw)   out += `<span class="tok-kw">${esc(kw)}</span>`;
      else if (slf)  out += `<span class="tok-self">${esc(slf)}</span>`;
      else if (num)  out += `<span class="tok-num">${esc(num)}</span>`;
      else if (call) out += `<span class="tok-fn">${esc(call)}</span>`;
      last = offset + m.length;
      return m;
    });
    out += esc(code.slice(last));
    return out;
  }

  function codeBlockHtml(code, title) {
    return `
      <div class="code-block">
        <div class="code-head">
          <span class="code-title"><span class="code-dots"><i></i><i></i><i></i></span>${esc(title || "python")}</span>
          <button class="copy-btn" data-copy>Copy</button>
        </div>
        <pre><code>${highlightPy(code)}</code></pre>
      </div>`;
  }

  // delegate copy buttons
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const code = btn.closest(".code-block").querySelector("pre").innerText;
    const markCopied = () => {
      btn.textContent = "Copied ✓";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1800);
    };
    const legacyCopy = () => {
      // fallback for non-secure contexts (file://) where clipboard API is unavailable
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      ok ? markCopied() : showToast("Copy failed — select the code manually");
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(markCopied).catch(legacyCopy);
    } else {
      legacyCopy();
    }
  });

  /* ---------------- sidebar / nav ---------------- */

  function renderNav() {
    const current = location.hash.match(/^#\/(?:m|q)\/([\w-]+)/)?.[1];
    let html = "";
    for (const group of COURSE.groups) {
      html += `<div class="nav-section">${esc(group.name)}</div>`;
      for (const id of group.modules) {
        const m = COURSE.modules[id];
        html += `
          <button class="nav-item ${id === current ? "active" : ""} ${isDone(id) ? "done" : ""}" data-go="#/m/${id}">
            <span class="icon">${m.icon}</span>
            <span class="label">${esc(m.title)}</span>
            <span class="check">✔</span>
          </button>`;
      }
    }
    nav.innerHTML = html;
  }

  nav.addEventListener("click", (e) => {
    const item = e.target.closest("[data-go]");
    if (!item) return;
    location.hash = item.dataset.go;
    sidebar.classList.remove("open");
  });

  document.getElementById("brand").addEventListener("click", () => {
    location.hash = "#/";
    sidebar.classList.remove("open");
  });

  document.getElementById("hamburger")?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (!confirm("Reset all reading progress and quiz scores?")) return;
    progress = {};
    saveProgress(progress);
    renderNav(); renderRing(); route();
    showToast("Progress reset");
  });

  /* ---------------- progress ring ---------------- */

  function renderRing() {
    const ids = Object.keys(COURSE.modules);
    const pct = ids.reduce((acc, id) => acc + modPct(id), 0) / ids.length;
    const done = ids.filter(isDone).length;
    const C = 2 * Math.PI * 34; // matches stroke-dasharray in CSS
    document.getElementById("ring-fg").style.strokeDashoffset = C * (1 - pct);
    document.getElementById("ring-label").textContent = Math.round(pct * 100) + "%";
    document.getElementById("progress-detail").textContent =
      `${done} of ${ids.length} modules mastered`;
  }

  /* ---------------- views ---------------- */

  function setView(html) {
    view.classList.remove("entering");
    void view.offsetWidth;            // restart animation
    view.innerHTML = html;
    view.classList.add("entering");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function renderHome() {
    const ids = Object.keys(COURSE.modules);
    const done = ids.filter(isDone).length;
    let cards = "";
    for (const group of COURSE.groups) {
      for (const id of group.modules) {
        const m = COURSE.modules[id];
        const s = modState(id);
        const pill = isDone(id)
          ? `<span class="pill done">Mastered</span>`
          : s.read || s.best > 0
            ? `<span class="pill read">In progress</span>`
            : `<span class="pill todo">Start</span>`;
        const score = s.best > 0 ? `<span class="card-score">best ${s.best}/${s.total}</span>` : "";
        cards += `
          <div class="module-card" data-go="#/m/${id}" tabindex="0" role="link">
            <div class="card-icon">${m.icon}</div>
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.desc)}</p>
            <div class="card-foot">${pill}${score}</div>
          </div>`;
      }
    }
    setView(`
      <section class="hero">
        <span class="hero-kicker">⬡ Staff SOAR Engineer Track</span>
        <h1>Master the Python that<br><span class="grad">passes the interview.</span></h1>
        <p>Eleven focused modules covering core Python, concurrency, and the SOAR engineering
           stack — Slack, PagerDuty, Kubernetes, alert correlation — each ending with an
           interview-style quiz. ${done > 0 ? `You've mastered <strong>${done}</strong> so far. Keep going.` : "Pick a module to begin."}</p>
      </section>
      <div class="module-grid stagger">${cards}</div>
    `);
    attachCardHandlers();
  }

  function attachCardHandlers() {
    view.querySelectorAll(".module-card").forEach((card) => {
      card.addEventListener("click", () => (location.hash = card.dataset.go));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); location.hash = card.dataset.go; }
      });
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  function blockHtml(b) {
    if (b.h2) return `<h2>${md(b.h2)}</h2>`;
    if (b.h3) return `<h3>${md(b.h3)}</h3>`;
    if (b.p) return `<p>${md(b.p)}</p>`;
    if (b.ul) return `<ul>${b.ul.map((li) => `<li>${md(li)}</li>`).join("")}</ul>`;
    if (b.code) return codeBlockHtml(b.code, b.title);
    if (b.callout) {
      const icons = { tip: "💡", warn: "⚠️", star: "⭐" };
      return `
        <div class="callout ${b.callout}">
          <span class="co-icon">${icons[b.callout] || "💡"}</span>
          <div><div class="co-title">${esc(b.title || b.callout)}</div>${md(b.body)}</div>
        </div>`;
    }
    return "";
  }

  function renderLesson(id) {
    const m = COURSE.modules[id];
    if (!m) return renderHome();
    const s = modState(id);
    setView(`
      <article>
        <header class="lesson-head">
          <button class="crumb" data-go="#/">← All modules</button>
          <h1>${m.icon}&nbsp; ${esc(m.title)}</h1>
          <p class="lede">${esc(m.tagline)}</p>
        </header>
        <div class="lesson-body">
          ${m.sections.map(blockHtml).join("")}
        </div>
        <div class="lesson-actions">
          <button class="btn btn-primary" data-go="#/q/${id}">
            Take the quiz → <span style="opacity:.75">(${m.quiz.length} questions${s.best ? `, best ${s.best}/${s.total}` : ""})</span>
          </button>
          <button class="btn btn-ghost" id="mark-read">
            ${s.read ? "✓ Marked as read" : "Mark as read"}
          </button>
        </div>
      </article>
    `);
    view.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", () => (location.hash = el.dataset.go)));
    document.getElementById("mark-read").addEventListener("click", (e) => {
      setModState(id, { read: true });
      e.target.textContent = "✓ Marked as read";
      showToast("Module marked as read");
    });
  }

  /* ---------------- quiz engine ---------------- */

  function renderQuiz(id) {
    const m = COURSE.modules[id];
    if (!m) return renderHome();
    setModState(id, { read: true });           // starting the quiz implies reading

    const state = { i: 0, score: 0, answered: false };
    const total = m.quiz.length;

    setView(`
      <div class="quiz-wrap">
        <div class="quiz-top">
          <button class="crumb" id="quiz-back">← ${esc(m.title)}</button>
          <div class="quiz-progress-track"><div class="quiz-progress-fill" id="qfill"></div></div>
          <span class="quiz-count" id="qcount"></span>
        </div>
        <div id="qslot"></div>
      </div>
    `);
    document.getElementById("quiz-back").addEventListener("click", () => (location.hash = `#/m/${id}`));

    const slot = document.getElementById("qslot");

    function renderQuestion() {
      const item = m.quiz[state.i];
      state.answered = false;
      document.getElementById("qfill").style.width = `${(state.i / total) * 100}%`;
      document.getElementById("qcount").textContent = `${state.i + 1} / ${total}`;
      const keys = ["A", "B", "C", "D"];
      slot.innerHTML = `
        <div class="quiz-card">
          <div class="quiz-q">${md(item.q)}</div>
          ${item.code ? `<div class="quiz-q-code">${codeBlockHtml(item.code, "snippet.py")}</div>` : ""}
          <div class="quiz-opts">
            ${item.opts.map((o, idx) => `
              <button class="quiz-opt" data-idx="${idx}">
                <span class="key">${keys[idx]}</span><span>${md(o)}</span>
              </button>`).join("")}
          </div>
          <div id="explain-slot"></div>
          <div class="quiz-next" id="next-slot"></div>
        </div>`;

      slot.querySelectorAll(".quiz-opt").forEach((btn) => {
        btn.addEventListener("click", () => answer(parseInt(btn.dataset.idx, 10)));
      });
    }

    function answer(idx) {
      if (state.answered) return;
      state.answered = true;
      const item = m.quiz[state.i];
      const correct = idx === item.answer;
      if (correct) state.score++;

      slot.querySelectorAll(".quiz-opt").forEach((btn) => {
        const b = parseInt(btn.dataset.idx, 10);
        btn.disabled = true;
        if (b === item.answer) btn.classList.add("correct");
        else if (b === idx) btn.classList.add("wrong");
        else btn.classList.add("dim");
      });

      document.getElementById("explain-slot").innerHTML = `
        <div class="quiz-explain"><strong>${correct ? "Correct." : "Not quite."}</strong> ${md(item.explain)}</div>`;
      document.getElementById("next-slot").innerHTML = `
        <button class="btn btn-primary" id="next-btn">${state.i + 1 < total ? "Next question →" : "See results →"}</button>`;
      const nextBtn = document.getElementById("next-btn");
      nextBtn.focus();
      nextBtn.addEventListener("click", () => {
        state.i++;
        if (state.i < total) renderQuestion();
        else renderResults();
      });
    }

    function renderResults() {
      document.getElementById("qfill").style.width = "100%";
      document.getElementById("qcount").textContent = `${total} / ${total}`;

      const prev = modState(id).best;
      if (state.score > prev) setModState(id, { best: state.score, total });
      else setModState(id, { total });          // refresh nav/ring anyway

      const pct = state.score / total;
      const mastered = pct >= 0.8;
      const emoji = mastered ? "🏆" : pct >= 0.5 ? "💪" : "📚";
      const headline = mastered ? "Mastered!" : pct >= 0.5 ? "Almost there" : "Keep studying";
      const sub = mastered
        ? "You'd handle this topic confidently in the interview."
        : "Review the lesson and retake the quiz — 80% marks a module as mastered.";

      slot.innerHTML = `
        <div class="result-card">
          <span class="result-emoji">${emoji}</span>
          <h2>${headline}</h2>
          <div class="result-score">${state.score}/${total}</div>
          <p class="result-sub">${sub}${state.score > prev && prev > 0 ? " New personal best!" : ""}</p>
          <div class="result-actions">
            <button class="btn btn-ghost" id="r-review">Review lesson</button>
            <button class="btn btn-ghost" id="r-retry">Retake quiz</button>
            <button class="btn btn-primary" id="r-next">${nextModuleId(id) ? "Next module →" : "Back to dashboard"}</button>
          </div>
        </div>`;

      if (mastered) confetti();
      document.getElementById("r-review").addEventListener("click", () => (location.hash = `#/m/${id}`));
      document.getElementById("r-retry").addEventListener("click", () => renderQuiz(id));
      document.getElementById("r-next").addEventListener("click", () => {
        const nxt = nextModuleId(id);
        location.hash = nxt ? `#/m/${nxt}` : "#/";
      });
    }

    renderQuestion();
  }

  function nextModuleId(id) {
    const order = COURSE.groups.flatMap((g) => g.modules);
    const i = order.indexOf(id);
    return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
  }

  /* ---------------- confetti ---------------- */

  function confetti() {
    const colors = ["#7c6cff", "#38d9f5", "#ff6cab", "#3ddc97", "#ffc065"];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = 2.2 + Math.random() * 2 + "s";
      piece.style.animationDelay = Math.random() * 0.6 + "s";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 5200);
    }
  }

  /* ---------------- router ---------------- */

  function route() {
    const hash = location.hash || "#/";
    let match;
    if ((match = hash.match(/^#\/m\/([\w-]+)/))) renderLesson(match[1]);
    else if ((match = hash.match(/^#\/q\/([\w-]+)/))) renderQuiz(match[1]);
    else renderHome();
    renderNav();
  }

  window.addEventListener("hashchange", route);

  /* ---------------- boot ---------------- */
  renderNav();
  renderRing();
  route();
})();
