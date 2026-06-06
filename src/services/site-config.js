function isAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getHostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function getOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function isGoogleFamilyHost(hostname) {
  return /(^|\.)google\.com$/.test(hostname) || hostname === "labs.google";
}

function getGoogleProductIcon(siteUrl, siteName) {
  const parsedUrl = new URL(siteUrl);
  const hostname = parsedUrl.hostname;
  const pathname = parsedUrl.pathname;
  const normalizedName = String(siteName || "").trim().toLowerCase();
  const productBase = "https://knowledge.workspace.google.com/static/images/icons/product";
  const consumerProductIcons = {
    maps: "https://www.gstatic.com/images/branding/productlogos/maps_2025_round/v1/web-512dp/logo_maps_2025_round_color_1x_web_512dp.png",
    photos: "https://storage.googleapis.com/gweb-mobius-cdn/photos/uploads/383ce0413fa82bcaf6de49fd7997678b21b9762e.svg"
  };
  const productByName = {
    calendar: "calendar",
    docs: "docs",
    drive: "drive",
    gmail: "gmail",
    maps: "maps",
    photos: "photos",
    sheets: "sheets",
    slides: "slides"
  };

  let product = productByName[normalizedName] || "";

  if (!product && hostname === "docs.google.com") {
    if (pathname.includes("/document/")) product = "docs";
    if (pathname.includes("/spreadsheets/")) product = "sheets";
    if (pathname.includes("/presentation/")) product = "slides";
  }

  if (!product && hostname === "mail.google.com") product = "gmail";
  if (!product && hostname === "calendar.google.com") product = "calendar";
  if (!product && hostname === "drive.google.com") product = "drive";
  if (!product && hostname === "photos.google.com") product = "photos";
  if (!product && hostname === "www.google.com" && pathname.includes("/maps")) product = "maps";

  return consumerProductIcons[product] || (product ? `${productBase}/${product}.svg` : "");
}

function buildIconCandidates(siteUrl, customIconUrl, siteName) {
  const hostname = getHostname(siteUrl);
  const origin = getOrigin(siteUrl);
  const domain = encodeURIComponent(hostname);
  const customIcon = isAbsoluteHttpUrl(customIconUrl) ? customIconUrl : "";
  const googleProductIcon = isGoogleFamilyHost(hostname)
    ? getGoogleProductIcon(siteUrl, siteName)
    : "";
  const liveIcons = [
    hostname ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256` : "",
    origin ? `${origin}/apple-touch-icon.png` : "",
    origin ? `${origin}/favicon.svg` : "",
    origin ? `${origin}/favicon.ico` : "",
    hostname ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : ""
  ];

  if (isGoogleFamilyHost(hostname) && customIcon) {
    return uniqueValues([googleProductIcon, customIcon, ...liveIcons]);
  }

  return uniqueValues([googleProductIcon, ...liveIcons, customIcon]);
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

  if (!name || !url) {
    return null;
  }

  if (!isAbsoluteHttpUrl(url)) {
    return null;
  }

  if (iconUrl && !isAbsoluteHttpUrl(iconUrl)) {
    return null;
  }

  const customOrder = Number(rawSite.order);
  const order = Number.isFinite(customOrder) ? customOrder : index;
  const iconCandidates = buildIconCandidates(url, iconUrl, name);

  return {
    id: rawSite.id || `site-${index + 1}`,
    name,
    url,
    iconUrl: iconCandidates[0] || iconUrl,
    iconCandidates,
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
