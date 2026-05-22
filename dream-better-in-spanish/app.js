async function main() {
  const titleEl = document.getElementById("title");
  const audioEl = document.getElementById("audio");
  const transcriptEl = document.getElementById("transcript");
  const headerEl = document.querySelector("header");

  // Publish the sticky header's real height so CSS scroll-padding-top can keep
  // scrollIntoView() targets clear of it. The header grows/shrinks as controls
  // wrap (e.g. on rotation), so keep it in sync.
  const syncHeaderHeight = () => {
    document.documentElement.style.setProperty("--header-h", `${headerEl.offsetHeight}px`);
  };
  syncHeaderHeight();
  if (window.ResizeObserver) new ResizeObserver(syncHeaderHeight).observe(headerEl);
  window.addEventListener("resize", syncHeaderHeight);

  const episodeId = new URLSearchParams(window.location.search).get("ep");
  if (!episodeId) {
    window.location.replace("index.html");
    return;
  }

  const response = await fetch(`/data/episodes/${encodeURIComponent(episodeId)}.json`, { cache: "no-store" });
  if (!response.ok) {
    titleEl.textContent = `Failed to load transcript (${response.status})`;
    return;
  }
  const data = await response.json();
  document.title = `${data.title} — Dream Better In Spanish`;

  titleEl.textContent = data.title;
  audioEl.src = data.audio_url;

  const rows = [];
  const frag = document.createDocumentFragment();
  for (const seg of data.segments) {
    const row = document.createElement("div");
    row.className = "segment";
    row.dataset.seg = seg.id;

    const es = document.createElement("div");
    es.className = "es";
    es.textContent = seg.es;

    const en = document.createElement("div");
    en.className = "en";
    en.textContent = seg.en;

    row.appendChild(es);
    row.appendChild(en);
    row.addEventListener("click", () => {
      audioEl.currentTime = seg.start;
      audioEl.play();
    });
    rows.push(row);
    frag.appendChild(row);
  }
  transcriptEl.appendChild(frag);

  const replayBtn = document.getElementById("replay-segment");
  let activeIdx = -1;

  // block: "start" pins the active row just under the header (via the CSS
  // scroll-padding-top) instead of centering it, so the top of a tall phrase
  // chunk never slides under the sticky controls.
  const scrollToActive = (behavior) => {
    if (activeIdx >= 0) rows[activeIdx].scrollIntoView({ behavior, block: "start" });
  };

  audioEl.addEventListener("timeupdate", () => {
    const idx = findSegmentIndex(data.segments, audioEl.currentTime);
    if (idx === activeIdx) return;
    if (activeIdx >= 0) rows[activeIdx].classList.remove("active");
    activeIdx = idx;
    if (idx >= 0) {
      rows[idx].classList.add("active");
      scrollToActive("smooth");
    }
    replayBtn.disabled = idx < 0;
  });

  replayBtn.addEventListener("click", () => {
    if (activeIdx < 0) return;
    audioEl.currentTime = data.segments[activeIdx].start;
    audioEl.play();
  });

  for (const btn of document.querySelectorAll(".speed-btn")) {
    btn.addEventListener("click", () => {
      audioEl.playbackRate = parseFloat(btn.dataset.rate);
      for (const b of document.querySelectorAll(".speed-btn.active")) {
        b.classList.remove("active");
      }
      btn.classList.add("active");
    });
  }

  const toggleEnEl = document.getElementById("toggle-en");
  toggleEnEl.addEventListener("change", () => {
    document.body.classList.toggle("hide-en", toggleEnEl.checked);
    // Toggling reflows every row (two columns -> one), which shifts the active
    // row off-screen; snap back to it.
    scrollToActive("auto");
  });
}

function findSegmentIndex(segments, t) {
  let lo = 0, hi = segments.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start <= t) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

main();
