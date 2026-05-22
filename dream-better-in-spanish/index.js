async function main() {
  const root = document.getElementById("episodes");

  const response = await fetch("data/index.json", { cache: "no-store" });
  if (!response.ok) {
    root.textContent = `Failed to load index (${response.status})`;
    return;
  }
  const data = await response.json();

  if (!data.episodes.length) {
    root.textContent = "No episodes yet. Run `uv run python -m pipeline.main process-latest`.";
    return;
  }

  const frag = document.createDocumentFragment();
  for (const ep of data.episodes) {
    const a = document.createElement("a");
    a.href = `player.html?ep=${encodeURIComponent(ep.id)}`;
    a.className = "episode";

    const title = document.createElement("div");
    title.className = "ep-title";
    title.textContent = ep.title;

    const date = document.createElement("div");
    date.className = "ep-date";
    date.textContent = ep.published;

    a.appendChild(title);
    a.appendChild(date);
    frag.appendChild(a);
  }
  root.appendChild(frag);
}

main();
