// Hidden hotkey navigation and floating quick-switcher for billboard testing.
// Keyboard shortcuts:
//   1 -> Community Screen
//   2 -> Schools Screen
//   3 -> Data Science Screen
//   A or 0 -> Admin Simulator

export function initNav({ current = "community" } = {}) {
  // 1. Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    // Ignore if user is typing in an input or textarea
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

    if (e.key === "1") {
      if (current !== "community") location.href = "community.html";
    } else if (e.key === "2") {
      if (current !== "schools") location.href = "schools.html";
    } else if (e.key === "3") {
      if (current !== "datascience") location.href = "datascience.html";
    } else if (e.key === "a" || e.key === "A" || e.key === "0") {
      if (current !== "admin") location.href = "admin.html";
    } else if (e.key.toLowerCase() === "f") {
      toggleFullscreen();
    }
  });

  // 2. Hidden hover drawer in top-right corner
  const drawer = document.createElement("div");
  drawer.className = "hot-nav-drawer";
  drawer.setAttribute("aria-hidden", "true");
  drawer.innerHTML = `
    <div class="hot-nav-pill">
      <span class="hot-nav-label">DISPLAYS:</span>
      <a href="community.html" class="hot-nav-btn ${current === 'community' ? 'active' : ''}" title="Press 1">1: Community</a>
      <a href="schools.html" class="hot-nav-btn ${current === 'schools' ? 'active' : ''}" title="Press 2">2: Schools</a>
      <a href="datascience.html" class="hot-nav-btn ${current === 'datascience' ? 'active' : ''}" title="Press 3">3: Data Science</a>
      <a href="admin.html" class="hot-nav-btn ${current === 'admin' ? 'active' : ''}" title="Press A">A: Admin Portal</a>
      <button type="button" class="hot-nav-btn fs-btn" id="fs-toggle-btn" title="Press F">⛶ Fullscreen</button>
    </div>
  `;
  document.body.appendChild(drawer);

  const fsBtn = drawer.querySelector("#fs-toggle-btn");
  if (fsBtn) {
    fsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
}
