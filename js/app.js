/* Standalone Client-Side Application (Pure HTML, CSS, Vanilla JS)
 * Uses browser localStorage for user accounts, active session, favorites, progress, and reviews.
 */
const $app = document.getElementById("app");
const MYD = "၀၁၂၃၄၅၆၇၈၉";
const my = n => String(n).replace(/\d/g, d => MYD[d]);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = n => `<i data-lucide="${n}"></i>`;
const chIcon = c => `<img src="./images/chapter-icons/chapter-${c.id}.svg" alt="" width="40" height="40" loading="lazy">`;

// Active user session
let ME = null;

// LocalStorage Database Helpers
const DB = {
  get: (key, fallback) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn("localStorage quota exceeded or unavailable", e);
    }
  }
};

// Per-user data lives on currentUser (favorites, quizScores, videoProgress, completed)
// and is mirrored into the matching record of the 'users' array.
function saveMe() {
  if (!ME) return;
  DB.set("currentUser", ME);
  const users = DB.get("users", []);
  const i = users.findIndex(u => u.id === ME.id);
  if (i > -1) {
    users[i].favorites = ME.favorites;
    users[i].quizScores = ME.quizScores;
    users[i].videoProgress = ME.videoProgress;
    users[i].completed = ME.completed;
    DB.set("users", users);
  }
}

const getFavorites = () => (ME && ME.favorites) || [];
const getDone = () => (ME && ME.completed) || [];
const getScores = () => (ME && ME.quizScores) || {};
const setFavorites = v => { ME.favorites = v; saveMe(); };
const setDone = v => { ME.completed = v; saveMe(); };
const setScores = v => { ME.quizScores = v; saveMe(); };

// Admin superuser: full access bypass (no content is ever locked for admins)
const isAdmin = () => !!ME && isAdminEmail(ME.email);
const canAccess = () => true; // all content open; admins are always allowed

const allLessons = CHAPTERS.flatMap(c => c.lessons.map(l => ({ ...l, ch: c })));
const findLesson = id => allLessons.find(l => l.id === id);

// Toast notification helper
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.hidden = true), 2600);
}

// Media cleanup on navigation
let media = null;
function stopMedia() {
  if (media) {
    if (media.save) media.save();
    if (media.video) media.video.pause();
    media = null;
  }
}

// Navbar session display + mobile side drawer
const logout = () => {
  localStorage.removeItem("currentUser");
  firebaseAuth.signOut().finally(() => location.replace("./login.html"));
};

const NAV_LINKS = [
  ["#/", "", "book-open", "သင်ခန်းစာများ"],
  ["#/favorites", "favorites", "heart", "အကြိုက်ဆုံး"],
  ["#/about", "about", "info", "အကြောင်းအရာ"],
  ["#/team", "team", "users", "About Us"],
  ["#/reviews", "reviews", "star", "သုံးသပ်ချက်"],
  ["#/contact", "contact", "mail", "ဆက်သွယ်ရန်"]
];

function setDrawer(open) {
  const d = document.getElementById("drawer");
  const bd = document.getElementById("drawerBackdrop");
  const hb = document.getElementById("hamburger");
  if (!d || !bd) return;
  d.classList.toggle("open", open);
  bd.classList.toggle("open", open);
  d.setAttribute("aria-hidden", String(!open));
  if (hb) hb.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("drawer-open", open);
}

function renderDrawer() {
  const d = document.getElementById("drawer");
  if (!d || !ME) return;
  const initial = ME.username.trim().charAt(0).toUpperCase() || "?";
  d.innerHTML = `
    <button class="drawer-close" id="drawerClose" aria-label="ပိတ်ရန်">✕</button>
    <div class="drawer-profile">
      <span class="chip-av">${esc(initial)}</span>
      <div>
        <b>${esc(ME.username)}</b>
        ${isAdmin() ? `<span class="admin-badge">👑 Admin</span>` : `<small class="note">${esc(ME.email || "")}</small>`}
      </div>
    </div>
    ${NAV_LINKS.map(([href, r, ic, t]) => `<a href="${href}" data-r="${r}">${icon(ic)} ${t}</a>`).join("")}
    <a href="#/quiz" data-r="quiz">${icon("brain")} ဉာဏ်စမ်း</a>
    <button class="btn" id="drawerLogout">${icon("log-out")} အကောင့်ထွက်ရန်</button>`;
  document.getElementById("drawerClose").onclick = () => setDrawer(false);
  document.getElementById("drawerLogout").onclick = logout;
  d.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setDrawer(false)));
}

function renderUser() {
  const userbox = document.getElementById("userbox");
  if (!userbox) return;
  if (ME) {
    const initial = ME.username.trim().charAt(0).toUpperCase() || "?";
    userbox.innerHTML = `
      <div class="account-menu">
        <button type="button" class="chip account-trigger" id="accountTrigger" aria-expanded="false" aria-haspopup="true" aria-controls="accountDropdown">
          <span class="chip-av">${esc(initial)}</span>
          <span class="chip-name">မင်္ဂလာပါ ${esc(ME.username)}${isAdmin() ? " 👑 Admin" : ""}</span>
          ${icon("chevron-down")}
        </button>
        <div class="account-dropdown" id="accountDropdown" hidden>
          <button type="button" class="account-logout" id="logoutBtn">${icon("log-out")} အကောင့်ထွက်ရန်</button>
        </div>
      </div>`;
    const accountTrigger = document.getElementById("accountTrigger");
    const accountDropdown = document.getElementById("accountDropdown");
    const closeAccountMenu = () => {
      accountDropdown.hidden = true;
      accountTrigger.setAttribute("aria-expanded", "false");
    };
    accountTrigger.onclick = () => {
      const opening = !accountDropdown.hidden;
      accountDropdown.hidden = opening;
      accountTrigger.setAttribute("aria-expanded", String(!opening));
    };
    document.getElementById("logoutBtn").onclick = logout;
    document.addEventListener("click", e => {
      if (!userbox.contains(e.target)) closeAccountMenu();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeAccountMenu();
    });
    renderDrawer();
    const hb = document.getElementById("hamburger");
    const bd = document.getElementById("drawerBackdrop");
    if (hb) hb.onclick = () => setDrawer(true);
    if (bd) bd.onclick = () => setDrawer(false);
    document.addEventListener("keydown", e => { if (e.key === "Escape") setDrawer(false); });
    window.addEventListener("resize", () => { if (window.innerWidth >= 768) setDrawer(false); });
  } else {
    userbox.innerHTML = `<a class="btn sm ghost" href="./login.html">${icon("log-in")} ဝင်ရောက်ရန်</a>`;
  }
  if (window.lucide) lucide.createIcons();
}

/* ---------- Watch progress (anti-cheat) & quiz gatekeeper ---------- */
// currentUser.videoProgress[lessonId] = { pct, time }  (furthest sequentially-watched point)
// currentUser.videoProgress[chapterId] = average watch % of the chapter's lessons (0-100)
const QUIZ_UNLOCK_PCT = 70;

function lessonWatch(id) {
  const v = (ME.videoProgress || {})[id];
  return v && typeof v === "object" ? v : { pct: 0, time: typeof v === "number" ? v : 0 };
}

function chapterWatchPct(c) {
  const sum = c.lessons.reduce((a, l) => a + lessonWatch(l.id).pct, 0);
  return Math.round(sum / c.lessons.length);
}

function saveWatch(lessonId, chapter, time, duration) {
  const pct = duration ? Math.min(100, Math.round((time / duration) * 100)) : 0;
  const prev = lessonWatch(lessonId);
  ME.videoProgress = ME.videoProgress || {};
  ME.videoProgress[lessonId] = { pct: Math.max(prev.pct, pct), time: Math.max(prev.time, Math.floor(time)) };
  ME.videoProgress[chapter.id] = chapterWatchPct(chapter);
  saveMe();
}

const quizUnlocked = c => isAdmin() || chapterWatchPct(c) >= QUIZ_UNLOCK_PCT;

// Quiz row/button markup used on roadmap & chapter pages
function quizRowHtml(c, label) {
  const ok = quizUnlocked(c);
  const pct = chapterWatchPct(c);
  return `
    <a class="lrow quizrow ${ok ? "" : "locked"}" href="#/quiz/${c.id}" ${ok ? "" : `data-lock="${pct}"`}>
      <span class="dot q">${ok ? icon("brain") : "🔒"}</span>
      <span class="grow">${label}</span>
      ${ok ? icon("chevron-right") : ""}
    </a>`;
}

function quizLockMessage(pct) {
  return `ဉာဏ်စမ်းဖြေဆိုရန် သင်ခန်းစာဗီဒီယိုကို အနည်းဆုံး ၇၀% ကြည့်ရှုရပါမည် (လက်ရှိ: ${my(pct)}%)`;
}

function scoreBadge(c) {
  const s = getScores()[c.id];
  return s ? `<span class="score-badge">🏆 ဉာဏ်စမ်းရမှတ်: ${my(s.score)}/${my(s.total)}</span>` : "";
}

/* ---------- Progress & Score Helpers ---------- */
function markDone(id) {
  const done = getDone();
  if (!done.includes(id)) {
    done.push(id);
    setDone(done);
    celebrate(window.innerWidth / 2, window.innerHeight / 3, 45);
    toast("🎉 သင်ခန်းစာ ပြီးဆုံးပါပြီ!");
  }
}

function chProgress(c) {
  const done = getDone();
  const n = c.lessons.filter(l => done.includes(l.id)).length;
  return { n, total: c.lessons.length, pct: Math.round((n / c.lessons.length) * 100) };
}

const progressBar = (pct, label) => `
  <div class="prog" title="${label}">
    <div class="bar"><i style="width:${pct}%"></i></div>
    <small>${label}</small>
  </div>`;

const statusText = p => p.n === 0 ? "မစတင်ရသေးပါ" : p.n === p.total ? "ပြီးဆုံးပါပြီ ✓" : `${my(p.n)}/${my(p.total)} ပြီးပြီ`;

function lessonRows(c) {
  const done = getDone();
  return c.lessons.map(l => `
    <a class="lrow" href="#/lesson/${l.id}">
      <span class="dot ${done.includes(l.id) ? "done" : ""}">${icon(done.includes(l.id) ? "check" : "play")}</span>
      <span class="grow">${my(l.id)} ${l.title}</span>
      ${icon("chevron-right")}
    </a>`).join("");
}

/* ---------- Views ---------- */
function home() {
  const done = getDone();
  return `
  <div class="hero">
    <div>
      <h1>👋 မင်္ဂလာပါ ${esc(ME ? ME.username : "")}!</h1>
      <p>ဒီနေ့ ဘာသင်ကြမလဲ? အခန်းတစ်ခုကို ရွေးပြီး စတင်လေ့လာကြစို့။</p>
    </div>
    <div class="hero-art" aria-hidden="true">🔭🌱🚀</div>
  </div>
  <h2 class="sec-title">${icon("map")} သင်ခန်းစာများ</h2>
  <div class="list roadmap">
    ${CHAPTERS.map(c => {
    const p = chProgress(c);
    const next = c.lessons.find(l => !done.includes(l.id)) || c.lessons[0];
    return `
      <div class="item c${c.id}" data-open>
        <div class="item-head">
          <div class="badge-num">${my(c.id)}</div>
          <div class="ic">${chIcon(c)}</div>
          <div class="grow">
            <b class="ttl">${c.title}</b>
            <small class="sub">သင်ခန်းစာ ${my(c.lessons.length)} ခု • ${statusText(p)}</small>
            ${progressBar(p.pct, my(p.pct) + "%")}
            ${scoreBadge(c)}
          </div>
          <a class="btn go" href="#/lesson/${next.id}">${icon("rocket")} ${p.n ? "ဆက်လေ့လာရန်" : "စတင်လေ့လာရန်"}</a>
          <span class="chev">${icon("chevron-down")}</span>
        </div>
        <div class="item-body">
          <div class="inner">
            ${lessonRows(c)}
            ${quizRowHtml(c, "ဉာဏ်စမ်းဖြေဆိုရန်")}
          </div>
        </div>
      </div>`;
  }).join("")}
  </div>`;
}

function chapterPage(id) {
  const c = CHAPTERS.find(x => x.id == id);
  if (!c) return notFound();
  return `
  <div class="crumb">
    <a href="#/">သင်ခန်းစာများ</a> ${icon("chevron-right")} ${my(c.id)}။ ${c.title}
  </div>
  <h1><span class="h1-ic">${chIcon(c)}</span> ${my(c.id)}။ ${c.title}</h1>
  <div class="item c${c.id} open">
    <div class="item-body">
      <div class="inner">
        ${lessonRows(c)}
        ${quizRowHtml(c, "ဤအခန်း ဉာဏ်စမ်းရန်")}
      </div>
    </div>
  </div>`;
}

const favHtml = on => on ? "❤️ အကြိုက်ဆုံးထဲ ထည့်ပြီး" : "🤍 အကြိုက်ဆုံးထဲ ထည့်ရန်";
const NARRATORS = [
  { key: "avatar-mm-female", l: "myanmar", g: "female", img: "./images/avatar-mm-female.jpg", fb: "./images/avatar-mm-female.svg", name: "ဆရာမလေး", lang: "မြန်မာ", desc: "အမျိုးသမီး ပြောပြသူ" },
  { key: "avatar-mm-male", l: "myanmar", g: "male", img: "./images/avatar-mm-male.jpg", fb: "./images/avatar-mm-male.svg", name: "ဆရာလေး", lang: "မြန်မာ", desc: "အမျိုးသား ပြောပြသူ" },
  { key: "avatar-karen-female", l: "karen", g: "female", img: "./images/avatar-karen-female.jpg", fb: "./images/avatar-mm-female.svg", name: "ဆရာမလေး", lang: "ကရင်", desc: "အမျိုးသမီး ပြောပြသူ" },
  { key: "avatar-karen-male", l: "karen", g: "male", img: "./images/avatar-karen-male.jpg", fb: "./images/avatar-mm-male.svg", name: "ဆရာလေး", lang: "ကရင်", desc: "အမျိုးသား ပြောပြသူ" }
];

function lessonPage(id) {
  const l = findLesson(id);
  if (!l) return notFound();
  const isFav = getFavorites().includes(id);

  return `
  <div class="crumb">
    <a href="#/">သင်ခန်းစာများ</a> ${icon("chevron-right")}
    <a href="#/chapter/${l.ch.id}">${l.ch.title}</a> ${icon("chevron-right")} ${my(l.id)}
  </div>
  <h1>${my(l.id)} ${l.title}</h1>
  <div class="lesson-layout">
    <div class="card player-card">
      <div class="player">
        <video id="vid" controls playsinline preload="metadata"></video>
      </div>
      <div class="language-picker" id="languagePicker" aria-label="ဘာသာစကား ရွေးချယ်ရန်">
        <button class="lang-btn active" data-lang="myanmar" type="button">မြန်မာဘာသာ</button>
        <button class="lang-btn" data-lang="karen" type="button">ကရင်ဘာသာ</button>
      </div>
      <div class="controls">
        <button class="btn ghost heart ${isFav ? "on" : ""}" id="favbtn" type="button">${favHtml(isFav)}</button>
      </div>
      <div class="watchbar" id="watchbar"></div>
      <p class="player-lock-note" id="lockNote"></p>
      <p class="note" id="mnote"></p>
    </div>

    <aside class="card narrator" id="narrator">
      <h2>${icon("mic")} ရှင်းပြပေးမည့်သူအား ရွေးချယ်ရန်</h2>
      <div class="chars">
        ${NARRATORS.map(n => `
        <button class="char narrator-card" data-avatar="${n.key}" data-g="${n.g}" data-l="${n.l}" aria-pressed="false" type="button">
          <span class="bubble" aria-hidden="true"></span>
          <span class="ring">
            <span class="pulse"></span>
            <span class="face">
              <img class="narrator-avatar avatar-img" src="${n.img}" alt="${n.name} (${n.lang})" width="85" height="85" onerror="this.onerror=null;this.src='${n.fb}'">
            </span>
          </span>
          <b>${n.name}</b>
          <span class="lang-tag">${n.lang}</span>
          <small>${n.desc}</small>
          <span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        </button>`).join("")}
      </div>
      <p class="note" id="nstat"></p>
    </aside>
  </div>`;
}

function mountLesson(id) {
  const l = findLesson(id);
  if (!l) return;

  const vid = document.getElementById("vid");

  // Avatar-based VIDEO selection.
  // No external audio is used anymore. The selected avatar determines
  // which lesson video is loaded and played.
  const note = document.getElementById("mnote");
  const lockNote = document.getElementById("lockNote");

  let activeLanguage = localStorage.getItem("activeLanguage") || "myanmar";
  let activeAvatar = localStorage.getItem("activeAvatar") || "avatar-mm-female";
  if (!NARRATORS.some(n => n.key === activeAvatar && n.l === activeLanguage)) {
    activeAvatar = activeLanguage === "karen" ? "avatar-karen-female" : "avatar-mm-female";
  }

  let maxT = lessonWatch(id).time || 0;
  let lastSave = 0;
  const flushProgress = () => {
    if (vid.duration) saveWatch(id, l.ch, maxT, vid.duration);
  };
  media = { video: vid, save: flushProgress };

  const watchbar = document.getElementById("watchbar");
  const drawWatch = () => {
    const pct = vid.duration ? Math.min(100, Math.round((maxT / vid.duration) * 100)) : lessonWatch(id).pct;
    watchbar.innerHTML = progressBar(pct, "ကြည့်ရှုပြီး " + my(pct) + "%");
  };
  drawWatch();

  // Video file convention:
  // public/videos/chapter-X/LESSON_ID_mm_female.mp4
  // public/videos/chapter-X/LESSON_ID_mm_male.mp4
  // public/videos/chapter-X/LESSON_ID_karen_female.mp4
  // public/videos/chapter-X/LESSON_ID_karen_male.mp4
  // If a character-specific file does not exist yet, fall back to the
  // original lesson video: LESSON_ID.mp4.
  const videoBase = `./public/videos/chapter-${l.ch.id}/`;
  const avatarVideoName = () => {
    const n = NARRATORS.find(x => x.key === activeAvatar);
    if (!n) return `${id}.mp4`;
    const lang = n.l === "myanmar" ? "mm" : "karen";
    return `${id}_${lang}_${n.g}.mp4`;
  };

  let currentVideoUrl = "";
  let videoRequestToken = 0;
  let wasPlayingBeforeSwitch = false;
  let switchTime = 0;

  const loadVideoForAvatar = (resume = false) => {
    const token = ++videoRequestToken;
    const targetName = avatarVideoName();
    const targetUrl = videoBase + targetName;
    const fallbackUrl = videoBase + `${id}.mp4`;
    const shouldResume = resume && !vid.paused;
    const resumeTime = switchTime;

    // Stop the current video before changing the source.
    vid.pause();
    currentVideoUrl = targetUrl;
    note.textContent = "";

    const useSource = (url, isFallback = false) => {
      if (token !== videoRequestToken) return;
      vid.src = url;
      vid.load();
      vid.addEventListener("loadedmetadata", function onMeta() {
        vid.removeEventListener("loadedmetadata", onMeta);
        if (token !== videoRequestToken) return;
        if (shouldResume && resumeTime > 0 && resumeTime < vid.duration) {
          vid.currentTime = resumeTime;
        } else if (maxT > 0 && maxT < vid.duration - 2) {
          vid.currentTime = maxT;
        }
        drawWatch();
        if (shouldResume) vid.play().catch(() => { });
      }, { once: true });
    };

    // Try avatar-specific video first. If it is missing, use the original
    // lesson video so the existing project remains playable.
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      probe.remove();
      useSource(targetUrl, false);
    };
    probe.onerror = () => {
      probe.remove();
      useSource(fallbackUrl, true);
    };
    probe.src = targetUrl;
  };

  vid.addEventListener("error", () => {
    // Ignore errors caused by the temporary avatar-video probe/fallback.
    if (!vid.src) return;
    note.textContent = "ဗီဒီယိုဖိုင် မတွေ့ပါ — " + vid.getAttribute("src");
  });
  vid.addEventListener("loadedmetadata", () => {
    drawWatch();
  });

  // Video-only playback: original video audio is enabled normally.
  // There is NO external <audio> element and no mute override.
  vid.muted = false;
  vid.volume = 1;

  // Anti-cheat: block skipping ahead of what has been watched (admins bypass)
  vid.addEventListener("seeking", () => {
    if (!isAdmin() && vid.currentTime > maxT + 1.5) {
      vid.currentTime = maxT;
      toast("ရှေ့သို့ ကျော်၍မရပါ — ဗီဒီယိုကို အစီအစဉ်အတိုင်း ကြည့်ရှုပါ");
    }
  });
  vid.addEventListener("timeupdate", () => {
    if (!vid.seeking && vid.currentTime <= maxT + 1.5) maxT = Math.max(maxT, vid.currentTime);
    drawWatch();
    const now = Date.now();
    if (now - lastSave > 3000) { lastSave = now; flushProgress(); }
    if (vid.duration && maxT / vid.duration > 0.9) markDone(id);
  });
  vid.addEventListener("pause", flushProgress);
  vid.addEventListener("ended", () => {
    maxT = vid.duration || maxT;
    flushProgress();
    drawWatch();
    markDone(id);
  });

  const chars = [...document.querySelectorAll(".char")];
  const languageButtons = [...document.querySelectorAll(".lang-btn")];
  const nstat = document.getElementById("nstat");
  const panel = document.getElementById("narrator");

  const refreshLanguage = () => {
    languageButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === activeLanguage);
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === activeLanguage));
    });
    chars.forEach(b => {
      b.hidden = b.dataset.l !== activeLanguage;
    });
  };

  const refreshNarrator = () => {
    const talking = panel.classList.contains("talking");
    chars.forEach(b => {
      const on = b.dataset.avatar === activeAvatar && b.dataset.l === activeLanguage;
      b.classList.toggle("active", on);
      b.hidden = b.dataset.l !== activeLanguage;
      b.setAttribute("aria-pressed", String(on));
      const bubble = b.querySelector(".bubble");
      if (bubble) bubble.textContent = on ? (talking ? "ကြည့်ရှုနေပါနော် 🎥" : "ဒီဗီဒီယိုကို ရွေးထားပါတယ် ✨") : "";
    });
    if (nstat) {
      const narr = NARRATORS.find(n => n.key === activeAvatar);
      if (narr) {
        nstat.textContent = (narr.l === "karen" ? "ကရင် • " : "မြန်မာ • ") +
          (narr.g === "female" ? "ဆရာမလေး" : "ဆရာလေး") +
          " အတွက် သက်ဆိုင်ရာဗီဒီယိုကို ရွေးထားပါသည်။";
      }
    }
  };

  // Language selection now changes the active avatar/video selection.
  languageButtons.forEach(btn => {
    btn.onclick = () => {
      const newLanguage = btn.dataset.lang;
      if (newLanguage === activeLanguage) return;
      if (!vid.paused && !vid.ended) {
        toast("ဗီဒီယိုဖွင့်နေစဉ် ဘာသာစကား မပြောင်းနိုင်ပါ");
        return;
      }
      activeLanguage = newLanguage;
      localStorage.setItem("activeLanguage", activeLanguage);
      const first = NARRATORS.find(n => n.l === activeLanguage);
      activeAvatar = first ? first.key : activeAvatar;
      localStorage.setItem("activeAvatar", activeAvatar);
      refreshLanguage();
      refreshNarrator();
      switchTime = 0;
      loadVideoForAvatar(false);
    };
  });

  // Avatar selection changes the VIDEO itself. No audio file is loaded.
  chars.forEach(b => {
    b.onclick = () => {
      const newAvatar = b.dataset.avatar;
      if (b.dataset.l !== activeLanguage) return;
      if (newAvatar === activeAvatar) return;
      if (!vid.paused && !vid.ended) {
        toast("ဗီဒီယိုဖွင့်နေစဉ် ဆရာ/ဆရာမ မပြောင်းနိုင်ပါ");
        return;
      }

      activeAvatar = newAvatar;
      localStorage.setItem("activeAvatar", activeAvatar);
      refreshNarrator();
      switchTime = 0;
      loadVideoForAvatar(false);

      const r = b.getBoundingClientRect();
      celebrate(r.left + r.width / 2, r.top + 40, 18);
    };
  });

  const talk = on => {
    panel.classList.toggle("talking", on);
    refreshNarrator();
  };
  vid.addEventListener("playing", () => talk(true));
  vid.addEventListener("pause", () => talk(false));
  vid.addEventListener("waiting", () => talk(false));
  vid.addEventListener("ended", () => talk(false));

  refreshLanguage();
  refreshNarrator();
  loadVideoForAvatar(false);

  // Favorite toggle: dynamic text + heart, persisted to currentUser.favorites
  const favBtn = document.getElementById("favbtn");
  favBtn.onclick = () => {
    const favs = getFavorites().slice();
    const idx = favs.indexOf(id);
    const favorited = idx === -1;
    if (favorited) {
      favs.push(id);
      toast("အကြိုက်ဆုံးထဲ ထည့်ပြီး");
      const r = favBtn.getBoundingClientRect();
      celebrate(r.left + r.width / 2, r.top, 25);
    } else {
      favs.splice(idx, 1);
      toast("အကြိုက်ဆုံးမှ ဖယ်ရှားပြီး");
    }
    setFavorites(favs);
    favBtn.classList.toggle("on", favorited);
    favBtn.innerHTML = favHtml(favorited);
  };
}

function favoritesPage() {
  const favs = getFavorites();
  const list = favs.map(findLesson).filter(Boolean);

  return `
  <h2 class="sec-title">${icon("heart")} အကြိုက်ဆုံး</h2>` +
    (list.length
      ? `<div class="list">${list.map(l => `
      <div class="item c${l.ch.id}">
        <div class="item-head">
          <div class="ic">${chIcon(l.ch)}</div>
          <div class="grow">
            <b class="ttl">${my(l.id)} ${l.title}</b>
            <small class="sub">${l.ch.title}</small>
          </div>
          <a class="btn go" href="#/lesson/${l.id}">${icon("play")} ကြည့်ရန်</a>
          <button class="btn sm danger" data-rm="${l.id}" aria-label="ဖယ်ရှားရန်">${icon("trash-2")}</button>
        </div>
      </div>`).join("")}</div>`
      : `<div class="card empty-state">
        <img src="./images/empty-favorites.svg" alt="" width="200" height="160">
        <h2>အကြိုက်ဆုံး သင်ခန်းစာ မရှိသေးပါ</h2>
        <p>သင်ခန်းစာကြည့်စဉ် ${icon("heart")} ခလုတ်ကို နှိပ်ပြီး နှစ်သက်ရာကို သိမ်းထားလိုက်ပါနော်။</p>
        <a class="btn" href="#/">${icon("rocket")} သင်ခန်းစာများ ကြည့်မယ်</a>
      </div>`);
}


/* About Us team data: edit names, seat numbers, sections and roles here.
   Photos follow the precise order in which they were supplied (1-8).
   The sample person data is temporarily shown on photo 5; update if needed. */
const TEAM_MEMBERS = [
  { photo: 4, name: "မောင်စိုးသူ", seat: "၂၅၂၆-၁-ကသန-၂၃", section: "Section A", role: "Leader/Coding" },
  { photo: 2, name: "မောင်ဘုန်းပိုင်ဦး", seat: "၂၅၂၆-၁-ကသန-၄၄", section: "Section A", role: "PPT/Image Creation" },
  { photo: 3, name: "စောမင်းမြတ်သာ", seat: "၂၅၂၆-၁-ကသန-၃၉", section: "Section A", role: "Voice Editor " },
  { photo: 1, name: "စောကျော်ဇင်မင်းထွဋ်", seat: "၂၅၂၆-၁-ကသန-၈၁", section: "Section B", role: "Translator" },
  { photo: 5, name: "မသဲအိလင်း", seat: "၂၅၂၆-၁-ကသန-၈", section: "Section A", role: "UI/UX Designer" },
  { photo: 6, name: "မအိအိငြိမ်းဖြူ", seat: "၂၅၂၆-၁-ကသန-၉", section: "Section A", role: "Video Generating" },
  { photo: 7, name: "မအိ‌န္ဒြေဦး", seat: "၂၅၂၆-၁-ကသန-၂၀", section: "Section A", role: "Resources" },
  { photo: 8, name: "နန်းတင်နွယ်၀င်", seat: "၂၅၂၆-၁-ကသန-၅၂", section: "Section B", role: "Translator" }
];

function teamPage() {
  const clean = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<section class="team-page">
    <div class="team-hero">
      <span class="team-eyebrow">K-SCI LEARN · PROJECT SHOW 2026</span>
      <h1>Meet Our Team <span aria-hidden="true">✨</span></h1>
      <p>သိပ္ပံပညာကို ပိုမိုလွယ်ကူစွာ သင်ယူနိုင်ဖို့ အတူတကွ ဖန်တီးနေကြသော အဖွဲ့ဝင်များ</p>
      <div class="team-count">${icon('users')} Our 8 Team Members</div>
    </div>
    <div class="team-grid">
      ${TEAM_MEMBERS.map((m, i) => `<article class="team-card" style="--team-i:${i}">
        <div class="team-photo-wrap"><img src="./images/team/member-${m.photo}.jpg" alt="Team member ${m.photo}" loading="lazy"><span class="team-number">${String(i + 1).padStart(2, '0')}</span></div>
        <div class="team-card-body">
          <h2>${clean(m.name)}</h2>
          <span class="team-role">${clean(m.role)}</span>
          <div class="team-details"><div><span>ခုံနံပါတ်</span><strong>${clean(m.seat)}</strong></div><div><span>အခန်း</span><strong>${clean(m.section)}</strong></div></div>
        </div>
      </article>`).join('')}
    </div>
    <div class="team-footer">Together, we make science learning more exciting. <span aria-hidden="true">♥</span></div>
  </section>`;
}

function aboutPage() {
  const sec = (ic, t, body) => `
    <div class="card sec">
      ${icon(ic)}
      <div>
        <h2>${t}</h2>
        ${body}
      </div>
    </div>`;

  return `
  <h1>${icon("info")} အကြောင်းအရာ</h1>
  <div style="display:grid;gap:1rem">
    ${sec("target", "ရည်ရွယ်ချက်", `<p>ကျောင်းသား/ ကျောင်းသူများအား သိပ္ပံဘာသာရပ်ကို မိခင်ဘာသာစကားဖြင့် လွယ်ကူစွာ နားလည်စေရန်နှင့် သင်ယူမှုအခွင့်အလမ်းကို လူတိုင်းတန်းတူရရှိစေရန် ရည်ရွယ်ပါသည်။</p>`)}
    ${sec("languages", "သင်ကြားရေးပုံစံ", `<p>သင်ခန်းစာတိုင်းကို ဗီဒီယိုဖြင့် ဖော်ပြပြီး မြန်မာဘာသာနှင့် ကရင်ဘာသာ အသံနှစ်မျိုးဖြင့် ရွေးချယ်ကြည့်ရှုနိုင်ပါသည်။ အခန်းတစ်ခုချင်းစီအတွက် ဉာဏ်စမ်းမေးခွန်းများလည်း ပါဝင်ပါသည်။</p>`)}
    ${sec("sparkles", "ပလက်ဖောင်းအကျိုးကျေးဇူးများ", `<ul>
      <li>ဘာသာစကားနှစ်မျိုးဖြင့် သင်ယူနိုင်ခြင်း</li>
      <li>နှစ်သက်သော သင်ခန်းစာများကို သိမ်းဆည်းနိုင်ခြင်း</li>
      <li>ဉာဏ်စမ်းဖြင့် ရလဒ်ကို ချက်ချင်းသိနိုင်ခြင်း</li>
      <li>မည်သည့် ဖုန်း၊ ကွန်ပျူတာ အမျိုးအစားမှမဆို အသုံးပြုနိုင်ခြင်း</li>
    </ul>`)}
  </div>`;
}

const starRow = n => `
  <span class="stars">${[1, 2, 3, 4, 5].map(i => `<i data-lucide="star" class="${i <= Math.round(n) ? "f" : ""}"></i>`).join("")}</span>`;

let pickRating = 0;
function reviewsPage() {
  // Pre-seed sample reviews if none exist in localStorage
  let rs = DB.get("reviews", null);
  if (!rs) {
    rs = [
      { id: 1, name: "သုတ", rating: 5, text: "အသံနှစ်မျိုးနဲ့ နားထောင်ရတာ အရမ်းအဆင်ပြေပြီး နားလည်လွယ်ပါတယ်!", created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 2, name: "နီနီ", rating: 5, text: "ရုပ်ပုံကာတွန်းလေးတွေနဲ့ ကလေးတွေအတွက် စိတ်ဝင်စားစရာ ကောင်းပါတယ်။", created_at: new Date().toISOString() }
    ];
    DB.set("reviews", rs);
  }

  const avg = rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0;

  return `
  <h1>${icon("star")} သုံးသပ်ချက်</h1>
  <div class="two">
    <div class="card" style="text-align:center">
      <h2 style="justify-content:center">စုစုပေါင်းအဆင့်သတ်မှတ်ချက်</h2>
      <div class="score">${rs.length ? my(avg.toFixed(1)) : "-"} / ၅</div>
      ${starRow(avg)}<br>
      <span class="badge" style="margin-top:.6rem">${icon("users")} သုံးသပ်ချက် ${my(rs.length)} ခု</span>
    </div>
    <form class="card" id="rform">
      <h2>သုံးသပ်ချက်ပေးရန်</h2>
      <div class="picker" id="picker"></div>
      <label class="field">
        ${icon("user")}
        <input name="name" placeholder="အမည်" value="${esc(ME ? ME.username : "")}" required maxlength="40">
      </label>
      <label class="field">
        ${icon("edit-3")}
        <textarea name="text" rows="4" placeholder="သင့်အမြင်ရေးရန်" required maxlength="500"></textarea>
      </label>
      <button class="btn" type="submit">${icon("send")} ပေးပို့မည်</button>
    </form>
  </div>
  <div class="card" style="margin-top:1rem">
    <h2>${icon("messages-square")} သုံးသပ်ချက်များ</h2>
    ${rs.length ? rs.slice(-10).reverse().map(r => `
      <div class="review">
        <div class="avatar">${esc(r.name.trim().charAt(0).toUpperCase() || "?")}</div>
        <div>
          <b>${esc(r.name)}</b> ${starRow(r.rating)}
          <small class="note">${esc(new Date(r.created_at).toLocaleDateString("my"))}</small>
          <div style="white-space:pre-wrap">${esc(r.text)}</div>
        </div>
      </div>`).join("") : `<p class="empty">သုံးသပ်ချက် မရှိသေးပါ</p>`}
  </div>`;
}

function drawPicker() {
  const p = document.getElementById("picker");
  if (!p) return;
  p.innerHTML = [1, 2, 3, 4, 5].map(i => `
    <button type="button" class="${i <= pickRating ? "f" : ""}" data-s="${i}" aria-label="${i} ကြယ်">
      ${icon("star")}
    </button>`).join("");
  if (window.lucide) lucide.createIcons();
  p.querySelectorAll("button").forEach(b => {
    b.onclick = () => {
      pickRating = +b.dataset.s;
      drawPicker();
    };
  });
}

function mountReviews() {
  pickRating = 0;
  drawPicker();
  const form = document.getElementById("rform");
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      if (!pickRating) return toast("ကြယ်အရေအတွက် ရွေးပါ");
      const f = new FormData(e.target);
      const rs = DB.get("reviews", []);
      rs.push({
        id: Date.now(),
        name: f.get("name").trim() || (ME ? ME.username : "ကျောင်းသား"),
        text: f.get("text").trim(),
        rating: pickRating,
        created_at: new Date().toISOString()
      });
      DB.set("reviews", rs);
      toast("ကျေးဇူးတင်ပါသည်");
      celebrate(window.innerWidth / 2, window.innerHeight / 2, 35);
      route();
    };
  }
}

function contactPage() {
  const adminEmail = typeof ADMIN_EMAIL !== "undefined" ? ADMIN_EMAIL : "admin@example.com";
  return `
  <h1>${icon("mail")} ဆက်သွယ်ရန်</h1>
  <form class="card" id="cform" style="max-width:600px">
    <label class="field">
      ${icon("user")}
      <input name="name" placeholder="အမည်" value="${esc(ME ? ME.username : "")}" required>
    </label>
    <label class="field">
      ${icon("mail")}
      <input name="email" type="email" placeholder="အီးမေးလ်" value="${esc(ME ? ME.email : "")}" required>
    </label>
    <label class="field">
      ${icon("message-square")}
      <textarea name="msg" rows="5" placeholder="အကြောင်းအရာ" required></textarea>
    </label>
    <button class="btn" type="submit">${icon("send")} ပေးပို့မည်</button>
  </form>`;
}

function mountContact() {
  const form = document.getElementById("cform");
  if (!form) return;
  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = f.get("name").trim();
    const email = f.get("email").trim();
    const msg = f.get("msg").trim();
    if (!EMAIL_RX.test(email)) return toast("အီးမေးလ်ပုံစံ မှားယွင်းနေပါသည်");

    const msgs = DB.get("messages", []);
    msgs.push({ id: Date.now(), name, email, msg, created_at: new Date().toISOString() });
    DB.set("messages", msgs);

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    if (emailConfigured()) {
      // Dispatch to ALL admin emails
      const results = await Promise.allSettled(ADMIN_EMAILS.map(to => sendEmail(EMAILJS_CONFIG.contactTemplateId, {
        to_email: to,
        to_name: "Admin",
        from_name: name,
        from_email: email,
        reply_to: email,
        subject: "ဆက်သွယ်ရန် - " + name,
        message: msg
      })));
      const sent = results.filter(r => r.status === "fulfilled").length;
      toast(sent ? `ပေးပို့ပြီးပါပြီ (${my(sent)}/${my(ADMIN_EMAILS.length)})` : "ပေးပို့၍ မအောင်မြင်ပါ၊ နောက်မှ ထပ်စမ်းပါ");
      if (sent) e.target.reset();
    } else {
      // fetch() ဖြင့် နောက်ကွယ်မှ တိုက်ရိုက်ပို့ခြင်း
      try {
        const response = await fetch("https://formspree.io/f/xdeaewpw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            name: name,
            email: email,
            message: msg
          })
        });

        if (response.ok) {
          toast("ပေးပို့ပြီးပါပြီ။ ကျေးဇူးတင်ပါသည်။");
          e.target.reset();
        } else {
          toast("ပေးပို့၍ မအောင်မြင်ပါ။ နောက်မှ ထပ်စမ်းပါ");
        }
      } catch (err) {
        toast("ကွန်ရက်ချိတ်ဆက်မှု မအောင်မြင်ပါ");
      }
    }
    submitBtn.disabled = false;
  };
}
function quizList() {
  const scores = getScores();
  return `
  <h2 class="sec-title">${icon("brain")} ဉာဏ်စမ်း</h2>
  <div class="list">
    ${CHAPTERS.map(c => {
    const t = QUIZZES[c.id].length;
    const s = scores[c.id]?.score;
    const pct = s != null ? Math.round((s / t) * 100) : 0;
    return `
      <div class="item c${c.id}">
        <div class="item-head">
          <div class="badge-num">${my(c.id)}</div>
          <div class="ic">${chIcon(c)}</div>
          <div class="grow">
            <b class="ttl">${c.title}</b>
            <small class="sub">မေးခွန်း ${my(t)} ခု • ${s != null ? "ဉာဏ်စမ်းရမှတ်: " + my(s) + "/" + my(t) : "မဖြေရသေးပါ"}</small>
            ${progressBar(pct, my(pct) + "%")}
          </div>
          ${quizUnlocked(c)
        ? `<a class="btn go" href="#/quiz/${c.id}">${icon(s != null ? "check-circle" : "rocket")} ${s != null ? "ပြန်လည်ဖြေရန်" : "စတင်ဖြေရန်"}</a>`
        : `<a class="btn go locked" href="#/quiz/${c.id}" data-lock="${chapterWatchPct(c)}">🔒 လော့ခ်ချထားသည်</a>`}
        </div>
      </div>`;
  }).join("")}
  </div>`;
}

function quizPage(id) {
  const c = CHAPTERS.find(x => x.id == id);
  const qs = QUIZZES[id];
  if (!c || !qs) return notFound();

  return `
  <div class="crumb">
    <a href="#/quiz">ဉာဏ်စမ်း</a> ${icon("chevron-right")} ${c.title}
  </div>
  <h1>${icon("award")} ${my(c.id)}။ ${c.title}</h1>
  <form class="card" id="qform">
    ${qs.map((q, i) => `
      <div class="q">
        <b>${my(i + 1)}။ ${q.q}</b>
        ${q.o.map((o, j) => `
          <label class="opt" data-q="${i}" data-o="${j}">
            <input type="radio" name="q${i}" value="${j}"> ${o}
          </label>`).join("")}
      </div>`).join("")}
    <div id="qres"></div>
    <button class="btn" type="submit">${icon("check-circle")} အဖြေတင်မည်</button>
    <a class="btn ghost" href="#/chapter/${c.id}">${icon("book-open")} သင်ခန်းစာသို့</a>
  </form>`;
}

function mountQuiz(id) {
  const qs = QUIZZES[id];
  const form = document.getElementById("qform");
  if (!form || !qs) return;

  form.onsubmit = e => {
    e.preventDefault();
    let score = 0;
    qs.forEach((q, i) => {
      const sel = form.querySelector(`input[name=q${i}]:checked`);
      form.querySelectorAll(`.opt[data-q="${i}"]`).forEach(l => {
        const j = +l.dataset.o;
        l.classList.toggle("ok", j === q.a);
        l.classList.toggle("bad", !!sel && +sel.value === j && j !== q.a);
      });
      if (sel && +sel.value === q.a) score++;
    });

    document.getElementById("qres").innerHTML = `
      <p class="result">${score === qs.length ? "🎉 " : ""}သင့်ရမှတ် - ${my(score)} / ${my(qs.length)} (${my(Math.round((score / qs.length) * 100))}%)</p>`;

    if (score >= Math.ceil(qs.length / 2)) {
      const b = e.submitter ? e.submitter.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
      celebrate(b.left + b.width / 2, b.top, score === qs.length ? 60 : 30);
    }

    // Persist result under currentUser.quizScores[chapterId]
    if (!ME.quizScores) ME.quizScores = {};
    ME.quizScores[id] = {
      score: score,
      total: qs.length,
      percentage: Math.round((score / qs.length) * 100),
      completedAt: new Date().toISOString()
    };
    saveMe();
  };
}

const notFound = () => `<div class="card empty">စာမျက်နှာ မတွေ့ပါ</div>`;

/* ---------- Confetti & Ripple Effects ---------- */
function celebrate(x, y, n = 28) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ff7eb6", "#ffb86b", "#ffe066", "#7be0ad", "#7cc4ff", "#b794f6"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    const a = Math.random() * Math.PI * 2;
    const d = 60 + Math.random() * 120;
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--r:${Math.random() * 720 - 360}deg;border-radius:${Math.random() > 0.5 ? "50%" : "2px"}`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

document.addEventListener("click", e => {
  const lk = e.target.closest("[data-lock]");
  if (lk) {
    e.preventDefault();
    e.stopPropagation();
    alert(quizLockMessage(+lk.dataset.lock));
    return;
  }
  const b = e.target.closest(".btn, .char, .lrow, .opt");
  if (b) {
    const r = b.getBoundingClientRect();
    const s = document.createElement("span");
    const size = Math.max(r.width, r.height);
    s.className = "ripple";
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }
  if (e.target.closest(".btn.go, .lrow")) {
    celebrate(e.clientX, e.clientY, 20);
  }
  const item = e.target.closest("[data-open]");
  if (item && !e.target.closest("a, button, input")) {
    item.classList.toggle("open");
  }
});

/* ---------- Router ---------- */
let routeSeq = 0;
function route() {
  const seq = ++routeSeq;
  stopMedia();
  const [r = "", arg] = location.hash.replace(/^#\/?/, "").split("/");

  document.querySelectorAll("#nav a, #drawer a").forEach(a => {
    a.classList.toggle("active", a.dataset.r === (r === "chapter" || r === "lesson" ? "" : r));
  });

  const pages = {
    "": home,
    chapter: () => chapterPage(arg),
    lesson: () => lessonPage(arg),
    favorites: favoritesPage,
    about: aboutPage,
    team: teamPage,
    reviews: reviewsPage,
    contact: contactPage,
    quiz: () => (arg ? quizPage(arg) : quizList())
  };

  // Quiz gatekeeper: direct URL access also requires 70% watch progress (admins bypass)
  if (r === "quiz" && arg) {
    const qc = CHAPTERS.find(x => x.id == arg);
    if (qc && !quizUnlocked(qc)) {
      alert(quizLockMessage(chapterWatchPct(qc)));
      location.hash = "#/chapter/" + qc.id;
      return;
    }
  }

  const renderer = pages[r] || notFound;
  $app.innerHTML = renderer();
  if ($app.firstElementChild) {
    $app.firstElementChild.classList.add("page-in");
  }
  if (r === "lesson") mountLesson(arg);
  if (r === "reviews") mountReviews();
  if (r === "contact") mountContact();
  if (r === "quiz" && arg) mountQuiz(arg);
  if (r === "favorites") {
    $app.querySelectorAll("[data-rm]").forEach(b => {
      b.onclick = () => {
        let favs = getFavorites();
        favs = favs.filter(x => x !== b.dataset.rm);
        setFavorites(favs);
        toast("အကြိုက်ဆုံးမှ ဖယ်ရှားပြီး");
        route();
      };
    });
  }

  if (window.lucide) lucide.createIcons();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

/* ---------- Firebase verified authentication gate ---------- */
firebaseAuth.onAuthStateChanged(async user => {
  if (!user) {
    localStorage.removeItem("currentUser");
    location.replace("./login.html");
    return;
  }
  try {
    await user.reload();
    if (!firebaseAuth.currentUser?.emailVerified) {
      localStorage.removeItem("currentUser");
      await firebaseAuth.signOut();
      location.replace("./login.html");
      return;
    }
    const verified = firebaseAuth.currentUser;
    const users = DB.get("users", []);
    let profile = users.find(p => p.firebaseUid === verified.uid);
    if (!profile) {
      profile = { id: verified.uid, firebaseUid: verified.uid, username: verified.displayName || verified.email.split("@")[0], email: verified.email, favorites: [], quizScores: {}, videoProgress: {}, completed: [] };
      users.push(profile);
      DB.set("users", users);
    }
    // Only Firebase's confirmed user ID is trusted; never trust stale localStorage sessions.
    ME = { ...profile, id: verified.uid, firebaseUid: verified.uid, email: verified.email, username: verified.displayName || profile.username };
    ME.isAdmin = isAdminEmail(ME.email);
    ME.favorites = ME.favorites || [];
    ME.quizScores = ME.quizScores || {};
    ME.videoProgress = ME.videoProgress || {};
    ME.completed = ME.completed || [];
    DB.set("currentUser", ME);
    document.body.classList.remove("auth-pending");
    renderUser();
    route();
  } catch (error) {
    console.error("Could not validate Firebase login", error);
    localStorage.removeItem("currentUser");
    location.replace("./login.html");
  }
});
