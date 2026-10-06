// Connects every display page to the backend's live state over WebSocket,
// with auto-reconnect. `onState(fn)` fires with every snapshot; `isStale()`
// tells a page whether the socket itself has been down long enough to show
// its own offline indicator (distinct from the backend's own `connected` flag,
// which reflects whether ITS upstream ACE API call is succeeding).

const RECONNECT_DELAY_MS = 2000;
const STALE_AFTER_MS = 8000;

let socket = null;
let lastMessageAt = 0;
const listeners = new Set();

function connect() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${proto}//${location.host}/ws`);

  socket.addEventListener("message", (event) => {
    lastMessageAt = Date.now();
    let snapshot;
    try {
      snapshot = JSON.parse(event.data);
    } catch {
      return;
    }
    for (const fn of listeners) fn(snapshot);
  });

  socket.addEventListener("close", () => {
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

export function onState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isStale() {
  return lastMessageAt === 0 || Date.now() - lastMessageAt > STALE_AFTER_MS;
}

connect();
