function isAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeKeywords(rawKeywords) {
  if (!Array.isArray(rawKeywords)) {
    return [];
  }

  return rawKeywords
    .map((keyword) => String(keyword).trim().toLowerCase())
    .filter(Boolean);
}

function normalizeSite(rawSite, index) {
  if (!rawSite || typeof rawSite !== "object") {
    return null;
  }

  const name = String(rawSite.name || "").trim();
  const url = String(rawSite.url || "").trim();
  const iconUrl = String(rawSite.iconUrl || "").trim();

  if (!name || !url || !iconUrl) {
    return null;
  }

  if (!isAbsoluteHttpUrl(url) || !isAbsoluteHttpUrl(iconUrl)) {
    return null;
  }

  const customOrder = Number(rawSite.order);
  const order = Number.isFinite(customOrder) ? customOrder : index;

  return {
    id: rawSite.id || `site-${index + 1}`,
    name,
    url,
    iconUrl,
    order,
    category: String(rawSite.category || "other").trim().toLowerCase(),
    note: String(rawSite.note || "").trim(),
    keywords: normalizeKeywords(rawSite.keywords)
  };
}

export async function loadSiteConfig() {
  const configUrl = new URL("../data/sites.json", import.meta.url);
  const response = await fetch(configUrl);

  if (!response.ok) {
    throw new Error(`site config fetch failed: ${response.status}`);
  }

  const json = await response.json();
  const rawSites = Array.isArray(json.sites) ? json.sites : [];
  const sites = rawSites.map(normalizeSite).filter(Boolean);

  return {
    version: json.version || 1,
    updatedAt: json.updatedAt || "unknown",
    openInNewTabByDefault: Boolean(json.openInNewTabByDefault),
    sites
  };
}
