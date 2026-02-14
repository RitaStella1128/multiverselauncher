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

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function getSiteCount(visits, siteId) {
  const count = Number(visits[siteId]?.count || 0);
  return Number.isFinite(count) ? count : 0;
}

function getSiteLastVisited(visits, siteId) {
  const ts = Number(visits[siteId]?.lastVisitedAt || 0);
  return Number.isFinite(ts) ? ts : 0;
}

function getMatchScore(site, normalizedQuery) {
  if (!normalizedQuery) {
    return 0;
  }

  const name = normalizeSearchText(site.name);
  const host = normalizeSearchText(site.url);
  const note = normalizeSearchText(site.note);
  const category = normalizeSearchText(site.category);
  const keywords = normalizeSearchText((site.keywords || []).join(" "));

  let score = 0;
  if (name === normalizedQuery) score += 1200;
  if (name.startsWith(normalizedQuery)) score += 900;
  if (name.includes(normalizedQuery)) score += 600;
  if (host.includes(normalizedQuery)) score += 400;
  if (keywords.includes(normalizedQuery)) score += 280;
  if (note.includes(normalizedQuery)) score += 220;
  if (category.includes(normalizedQuery)) score += 120;

  return score;
}

function sortSites(sites, visits, normalizedQuery) {
  const countScore = (site) => {
    return getSiteCount(visits, site.id);
  };
  const orderScore = (site) => (Number.isFinite(site.order) ? site.order : Number.MAX_SAFE_INTEGER);
  const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  const recencyScore = (site) => getSiteLastVisited(visits, site.id);
  const queryScore = (site) => getMatchScore(site, normalizedQuery);

  return [...sites].sort(
    (a, b) =>
      queryScore(b) - queryScore(a) ||
      countScore(b) - countScore(a) ||
      recencyScore(b) - recencyScore(a) ||
      orderScore(a) - orderScore(b) ||
      byName(a, b)
  );
}

function openSite(url, inNewTab) {
  window.open(url, inNewTab ? "_blank" : "_self", "noopener");
}

function renderQuickLaunch(listElement, quickSites, openInNewTab, onVisit) {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";
  if (quickSites.length === 0) {
    const empty = document.createElement("span");
    empty.className = "quick-empty";
    empty.textContent = "Open a site to build quick shortcuts.";
    listElement.appendChild(empty);
    return;
  }

  quickSites.forEach((site, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-item";
    button.textContent = `${index + 1}. ${site.name}`;
    button.title = `${site.name} (${site.count} opens)`;
    button.addEventListener("click", () => {
      onVisit(site.id);
      openSite(site.url, openInNewTab);
    });
    listElement.appendChild(button);
  });
}

function isTypingContext(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

async function initializeLauncher() {
  const searchInput = document.getElementById("site-search");
  const searchClear = document.getElementById("search-clear");
  const favoriteToggle = document.getElementById("favorites-toggle");
  const resetStats = document.getElementById("reset-stats");
  const siteCount = document.getElementById("site-count");
  const quickList = document.getElementById("quick-list");

  if (
    !searchInput ||
    !searchClear ||
    !favoriteToggle ||
    !resetStats ||
    !siteCount ||
    !quickList
  ) {
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
      renderCurrent();
    };

    const renderCurrent = () => {
      const normalizedQuery = normalizeSearchText(state.query);
      let visible = config.sites;

      if (normalizedQuery) {
        visible = visible.filter((site) => getMatchScore(site, normalizedQuery) > 0);
      }

      if (state.favoritesOnly) {
        visible = visible.filter((site) => state.favorites.has(site.id));
      }

      const sorted = sortSites(visible, state.visits, normalizedQuery);
      state.lastRendered = sorted;

      const quickSites = sortSites(config.sites, state.visits, "")
        .filter((site) => getSiteCount(state.visits, site.id) > 0)
        .slice(0, 8)
        .map((site) => ({ ...site, count: getSiteCount(state.visits, site.id) }));

      renderQuickLaunch(quickList, quickSites, config.openInNewTabByDefault, onVisit);

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

    searchClear.addEventListener("click", () => {
      if (searchInput.value) {
        searchInput.value = "";
        state.query = "";
        renderCurrent();
      }
      searchInput.focus();
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && state.lastRendered.length > 0) {
        event.preventDefault();
        const topSite = state.lastRendered[0];
        onVisit(topSite.id);
        openSite(topSite.url, config.openInNewTabByDefault);
      }
    });

    favoriteToggle.addEventListener("click", () => {
      state.favoritesOnly = !state.favoritesOnly;
      setFavoriteToggle(favoriteToggle, state.favoritesOnly);
      persistState();
      renderCurrent();
    });

    resetStats.addEventListener("click", () => {
      const confirmed = window.confirm("Open counts and favorites will be reset. Continue?");
      if (!confirmed) {
        return;
      }

      state.visits = {};
      state.favorites.clear();
      state.favoritesOnly = false;
      setFavoriteToggle(favoriteToggle, state.favoritesOnly);
      persistState();
      renderCurrent();
    });

    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if (event.altKey && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const site = state.lastRendered[index];
        if (site) {
          event.preventDefault();
          onVisit(site.id);
          openSite(site.url, config.openInNewTabByDefault);
        }
        return;
      }

      if (event.key === "/") {
        if (isTypingContext(event.target)) {
          return;
        }
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

      if (isTypingContext(event.target) && event.key !== "Escape") {
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
