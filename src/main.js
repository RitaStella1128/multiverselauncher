import {
  renderSites,
  renderLoadingState,
  renderEmptyState,
  renderErrorState
} from "./ui/grid.js";
import { loadSiteConfig } from "./services/site-config.js";

const STORAGE_KEYS = {
  favorites: "mv_launcher_favorites",
  visits: "mv_launcher_visits",
  favoritesOnly: "mv_launcher_favorites_only"
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write errors.
  }
}

function setFavoriteToggle(button, isEnabled) {
  button.setAttribute("aria-pressed", String(isEnabled));
  button.textContent = `FAVORITES ONLY: ${isEnabled ? "ON" : "OFF"}`;
}

function matchesQuery(site, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const text = [
    site.name,
    site.url,
    site.note,
    site.category,
    ...(site.keywords || [])
  ]
    .join(" ")
    .toLowerCase();

  return text.includes(normalized);
}

function sortSites(sites, favorites) {
  const favScore = (site) => (favorites.has(site.id) ? 1 : 0);
  const orderScore = (site) => (Number.isFinite(site.order) ? site.order : Number.MAX_SAFE_INTEGER);

  return [...sites].sort(
    (a, b) => favScore(b) - favScore(a) || orderScore(a) - orderScore(b)
  );
}

function isTypingContext(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

async function initializeLauncher() {
  const searchInput = document.getElementById("site-search");
  const favoriteToggle = document.getElementById("favorites-toggle");
  const siteCount = document.getElementById("site-count");

  if (!searchInput || !favoriteToggle || !siteCount) {
    return;
  }

  renderLoadingState(12);

  try {
    const config = await loadSiteConfig();
    const storedFavorites = readStorage(STORAGE_KEYS.favorites, []);
    const storedVisits = readStorage(STORAGE_KEYS.visits, {});

    const state = {
      query: "",
      favoritesOnly: Boolean(readStorage(STORAGE_KEYS.favoritesOnly, false)),
      favorites: new Set(Array.isArray(storedFavorites) ? storedFavorites : []),
      visits: storedVisits && typeof storedVisits === "object" ? storedVisits : {},
      lastRendered: []
    };

    setFavoriteToggle(favoriteToggle, state.favoritesOnly);

    const persistState = () => {
      writeStorage(STORAGE_KEYS.favoritesOnly, state.favoritesOnly);
      writeStorage(STORAGE_KEYS.favorites, [...state.favorites]);
      writeStorage(STORAGE_KEYS.visits, state.visits);
    };

    const onToggleFavorite = (siteId) => {
      if (state.favorites.has(siteId)) {
        state.favorites.delete(siteId);
      } else {
        state.favorites.add(siteId);
      }

      persistState();
      renderCurrent();
    };

    const onVisit = (siteId) => {
      const previous = state.visits[siteId] || { count: 0, lastVisitedAt: 0 };
      state.visits[siteId] = {
        count: Number(previous.count || 0) + 1,
        lastVisitedAt: Date.now()
      };

      writeStorage(STORAGE_KEYS.visits, state.visits);
    };

    const renderCurrent = () => {
      let visible = config.sites.filter((site) => matchesQuery(site, state.query));

      if (state.favoritesOnly) {
        visible = visible.filter((site) => state.favorites.has(site.id));
      }

      const sorted = sortSites(visible, state.favorites);
      state.lastRendered = sorted;

      if (sorted.length === 0) {
        renderEmptyState("一致するサイトがありません。");
      } else {
        renderSites({
          sites: sorted,
          openInNewTab: config.openInNewTabByDefault,
          favorites: state.favorites,
          visits: state.visits,
          onToggleFavorite,
          onVisit
        });
      }

      siteCount.textContent = `${sorted.length} / ${config.sites.length}`;
    };

    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      renderCurrent();
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && state.lastRendered.length > 0) {
        event.preventDefault();
        window.open(state.lastRendered[0].url, config.openInNewTabByDefault ? "_blank" : "_self", "noopener");
      }
    });

    favoriteToggle.addEventListener("click", () => {
      state.favoritesOnly = !state.favoritesOnly;
      setFavoriteToggle(favoriteToggle, state.favoritesOnly);
      persistState();
      renderCurrent();
    });

    document.addEventListener("keydown", (event) => {
      if (isTypingContext(event.target) && event.key !== "Escape") {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.key === "/") {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        state.favoritesOnly = !state.favoritesOnly;
        setFavoriteToggle(favoriteToggle, state.favoritesOnly);
        persistState();
        renderCurrent();
        return;
      }

      if (event.key === "Escape") {
        if (searchInput.value) {
          searchInput.value = "";
          state.query = "";
          renderCurrent();
        }

        searchInput.blur();
      }
    });

    renderCurrent();
    searchInput.focus();
  } catch (error) {
    console.error(error);
    renderErrorState("サイト設定の読み込みに失敗しました。ローカルサーバー経由で開いてください。");
    siteCount.textContent = "0 / 0";
  }
}

document.addEventListener("DOMContentLoaded", initializeLauncher);
