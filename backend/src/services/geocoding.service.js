const normalizeText = (text = "") =>
  String(text)
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .replace(/\s+,/g, ",")
    .trim();

const buildLocationQueries = (inputText = "") => {
  const normalized = normalizeText(inputText);
  if (!normalized) return [];

  const parts = normalized
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const noPincode = normalizeText(normalized.replace(/\b\d{6}\b/g, ""));
  const simplified =
    parts.length > 3 ? parts.slice(0, 3).join(", ") : normalized;
  const trailingThree =
    parts.length >= 3 ? parts.slice(-3).join(", ") : normalized;

  const ensureCountry = (q) => {
    if (!q) return "";
    return /india$/i.test(q) ? q : `${q}, India`;
  };

  const candidates = [
    normalized,
    noPincode,
    simplified,
    trailingThree,
    ensureCountry(normalized),
    ensureCountry(noPincode),
    ensureCountry(simplified),
    ensureCountry(trailingThree),
  ];

  // Debug: query order matters. Keep strongest original text first, then fallbacks.
  return [...new Set(candidates.filter(Boolean))];
};

const geocodeWithNominatim = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=in&q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "attendance-payroll-backend/1.0 (branch-geocode)",
      Accept: "application/json",
    },
  });

  // Debug: non-2xx usually means provider/network issue; caller should try next fallback query.
  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const best = data[0];
  const latitude = Number.parseFloat(best.lat);
  const longitude = Number.parseFloat(best.lon);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  return {
    latitude,
    longitude,
    displayName: best.display_name || query,
  };
};

const geocodeFromText = async (inputText) => {
  if (typeof fetch !== "function") return null;

  const queries = buildLocationQueries(inputText);
  // Debug tip: log this array when investigating why a text location is not resolving.
  for (const query of queries) {
    try {
      const result = await geocodeWithNominatim(query);
      if (result) return result;
    } catch (_error) {
      // Debug: ignore single-query failures and continue with remaining fallback candidates.
    }
  }

  return null;
};

module.exports = {
  geocodeFromText,
};
