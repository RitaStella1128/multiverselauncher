function getContainer(containerId) {
  return document.getElementById(containerId);
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown-host";
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return "NEVER";
  }

  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "JUST NOW";
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}M AGO`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}H AGO`;
  }

  return `${Math.floor(diffMs / day)}D AGO`;
}

function createSiteCard(site, options) {
  const { openInNewTab, favorites, visits, onToggleFavorite, onVisit } = options;

  const card = document.createElement("article");
  card.className = "site-card";

  const isFavorite = favorites.has(site.id);
  const visitData = visits[site.id] || { count: 0, lastVisitedAt: 0 };

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = `favorite-button${isFavorite ? " is-active" : ""}`;
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  favoriteButton.setAttribute("aria-label", `${site.name} favorite`);
  favoriteButton.title = isFavorite ? "Remove from favorites" : "Add to favorites";
  favoriteButton.textContent = isFavorite ? "★" : "☆";
  favoriteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleFavorite(site.id);
  });

  const link = document.createElement("a");
  link.className = "site-link";
  link.href = site.url;
  link.setAttribute("aria-label", `${site.name} open`);

  if (openInNewTab) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  link.addEventListener("click", () => {
    onVisit(site.id);
  });

  const top = document.createElement("div");
  top.className = "site-top";

  const iconWrap = document.createElement("div");
  iconWrap.className = "icon-wrap";

  const icon = document.createElement("img");
  icon.className = "site-icon";
  icon.src = site.iconUrl;
  icon.alt = `${site.name} icon`;
  icon.loading = "lazy";
  icon.decoding = "async";
  
  const iconFallback = document.createElement("span");
  iconFallback.className = "site-icon-fallback";
  iconFallback.textContent = site.name.slice(0, 1).toUpperCase();
  iconFallback.hidden = true;

  icon.addEventListener("error", () => {
    icon.hidden = true;
    iconFallback.hidden = false;
  });

  const titleWrap = document.createElement("div");
  titleWrap.className = "site-title-wrap";

  const title = document.createElement("h2");
  title.className = "site-name";
  title.textContent = site.name;
  title.title = site.name;

  const host = document.createElement("p");
  host.className = "site-host";
  host.textContent = getHostname(site.url);
  host.title = host.textContent;

  titleWrap.append(title, host);
  iconWrap.append(icon, iconFallback);
  top.append(iconWrap, titleWrap);

  const tags = document.createElement("div");
  tags.className = "site-tags";

  const category = document.createElement("span");
  category.className = "site-pill";
  category.textContent = String(site.category || "other").toUpperCase();

  const visit = document.createElement("span");
  visit.className = "site-visit";
  const openCount = Number(visitData.count || 0);
  visit.textContent = `${openCount} OPEN${openCount === 1 ? "" : "S"}`;
  visit.title = `Last opened: ${formatRelativeTime(visitData.lastVisitedAt)}`;

  tags.append(category, visit);

  link.append(top);

  if (site.note) {
    const note = document.createElement("p");
    note.className = "site-note";
    note.textContent = site.note;
    link.appendChild(note);
  }

  link.appendChild(tags);
  card.append(favoriteButton, link);

  return card;
}

function renderState(message, className, containerId = "link-container") {
  const container = getContainer(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const box = document.createElement("div");
  box.className = className;
  box.textContent = message;
  container.appendChild(box);
}

export function renderSites(options) {
  const {
    sites,
    containerId = "link-container",
    openInNewTab = true,
    favorites = new Set(),
    visits = {},
    onToggleFavorite = () => {},
    onVisit = () => {}
  } = options;

  const container = getContainer(containerId);
  if (!container) {
    return 0;
  }

  container.innerHTML = "";
  sites.forEach((site) => {
    container.appendChild(
      createSiteCard(site, {
        openInNewTab,
        favorites,
        visits,
        onToggleFavorite,
        onVisit
      })
    );
  });

  return sites.length;
}

export function renderLoadingState(count = 10, containerId = "link-container") {
  const container = getContainer(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "loading-skeleton";
    container.appendChild(skeleton);
  }
}

export function renderEmptyState(message, containerId = "link-container") {
  renderState(message, "empty-state", containerId);
}

export function renderErrorState(message, containerId = "link-container") {
  renderState(message, "error-state", containerId);
}
