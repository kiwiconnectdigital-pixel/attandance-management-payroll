import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import {
  XMarkIcon,
  MapPinIcon,
  ClockIcon,
  ArrowsPointingOutIcon,
  CalendarDaysIcon,
  UserIcon,
  SignalIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ArrowLeftOnRectangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import toast from "react-hot-toast";
import api, { attendanceAPI } from "../../services/api";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const REFRESH_MS = 20000;
const MIN_STAY_MINUTES = 5;
const STOP_RADIUS_M = 100;
const MAX_ACCURACY_M = 200;
const GAP_MINUTES = 20;
const GAP_MIN_DISTANCE_M = 300;

const SOURCE_COLOR = {
  checkin: "#16845B",
  checkout: "#C94B4B",
  periodic: "#3567D6",
};

/**
 * MAP TILES
 * Standard = OpenStreetMap (borders as on the ground).
 * India    = a tile provider that draws India's official boundary.
 *            Paste your provider's raster tile URL here, e.g.
 *            "https://YOUR-TILE-SERVER/{z}/{x}/{y}.png"
 *            (Mappls / MapmyIndia, Bhuvan, or any India-boundary provider).
 */
const INDIA_TILE_URL =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_INDIA_TILE_URL) ||
  "";

const INDIA_TILE_ATTRIBUTION =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_INDIA_TILE_ATTRIBUTION) ||
  "Map data &copy; provider";

const TILE_LAYERS = {
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  india: {
    url: INDIA_TILE_URL,
    attribution: INDIA_TILE_ATTRIBUTION,
  },
};

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function toNum(value) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(iso) {
  return iso
    ? new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function fmtTimeSec(date) {
  return date
    ? date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
}

function fmtDate(date) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtRange(stop) {
  return stop.start === stop.end
    ? fmtTime(stop.start)
    : `${fmtTime(stop.start)} – ${fmtTime(stop.end)}`;
}

function fmtDistance(meters) {
  if (!Number.isFinite(meters)) return "";
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function fmtDuration(minutes) {
  if (!Number.isFinite(minutes)) return "";
  const total = Math.max(0, Math.round(minutes));
  if (total < 1) return "<1 min";
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function getEmployeeId(employee) {
  return employee?.id ?? employee?._id;
}

function getEmployeeCode(employee) {
  return employee?.employeeCode || employee?.employee_code || "";
}

function getWorkingHours(record) {
  return (
    record?.workingHours ??
    record?.working_hours ??
    record?.totalWorkingHours ??
    record?.total_working_hours ??
    "—"
  );
}

function getOvertime(record) {
  return (
    record?.overtimeHours ?? record?.overtime_hours ?? record?.overtime ?? "—"
  );
}

function getStatus(record) {
  return record?.status || record?.attendance_status || "—";
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options = {}, timeoutMs = 14000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

/* ------------------------------------------------------------------ */
/*  Geometry                                                           */
/* ------------------------------------------------------------------ */

function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingDeg(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(toRad(b[0]));
  const x =
    Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
    Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function pathLength(path) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += haversineM(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
  }
  return total;
}

function arrowsAlong(path, max = 40) {
  const total = pathLength(path);
  const gapM = Math.max(250, total / 30);
  const arrows = [];
  let acc = 0;
  let next = gapM / 2;

  for (let i = 1; i < path.length && arrows.length < max; i += 1) {
    const seg = haversineM(
      path[i - 1][0],
      path[i - 1][1],
      path[i][0],
      path[i][1],
    );
    acc += seg;

    if (acc >= next) {
      arrows.push({ at: path[i], deg: bearingDeg(path[i - 1], path[i]) });
      next += gapM;
    }
  }

  return arrows;
}

/* ------------------------------------------------------------------ */
/*  Stops + travelled distance                                         */
/* ------------------------------------------------------------------ */

function buildStop(points) {
  const lat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
  const accuracies = points
    .map((p) => p.accuracy_meters)
    .filter((a) => Number.isFinite(a));

  return {
    key: `${lat.toFixed(4)},${lng.toFixed(4)}`,
    latitude: lat,
    longitude: lng,
    points,
    start: points[0].recorded_at,
    end: points[points.length - 1].recorded_at,
    checkins: points.filter((p) => p.source === "checkin"),
    checkouts: points.filter((p) => p.source === "checkout"),
    accuracy: accuracies.length ? Math.min(...accuracies) : null,
  };
}

function isEventStop(stop) {
  return stop.checkins.length > 0 || stop.checkouts.length > 0;
}

/** Consecutive pings within `radius` of the stop centre become ONE stop. */
function clusterTrail(points, radius = STOP_RADIUS_M) {
  const groups = [];
  let current = null;

  for (const point of points) {
    if (current) {
      const lat =
        current.reduce((sum, p) => sum + p.latitude, 0) / current.length;
      const lng =
        current.reduce((sum, p) => sum + p.longitude, 0) / current.length;

      if (haversineM(lat, lng, point.latitude, point.longitude) < radius) {
        current.push(point);
        continue;
      }
    }

    current = [point];
    groups.push(current);
  }

  const centre = (g) => ({
    lat: g.reduce((sum, p) => sum + p.latitude, 0) / g.length,
    lng: g.reduce((sum, p) => sum + p.longitude, 0) / g.length,
  });

  let changed = true;
  while (changed) {
    changed = false;

    for (let i = 1; i < groups.length - 1; i += 1) {
      const blip = groups[i];
      const hasEvent = blip.some(
        (p) => p.source === "checkin" || p.source === "checkout",
      );

      if (hasEvent || blip.length > 2) continue;

      const a = centre(groups[i - 1]);
      const b = centre(groups[i + 1]);

      if (haversineM(a.lat, a.lng, b.lat, b.lng) < radius) {
        groups.splice(i - 1, 3, [...groups[i - 1], ...blip, ...groups[i + 1]]);
        changed = true;
        break;
      }
    }
  }

  return groups.map(buildStop);
}

function buildTravel(from, to, trail) {
  let meters = 0;

  if (
    Number.isInteger(from.lastIdx) &&
    Number.isInteger(to.firstIdx) &&
    to.firstIdx > from.lastIdx
  ) {
    for (let i = from.lastIdx; i < to.firstIdx; i += 1) {
      meters += haversineM(
        trail[i].latitude,
        trail[i].longitude,
        trail[i + 1].latitude,
        trail[i + 1].longitude,
      );
    }
  } else {
    const a = from.points[from.points.length - 1];
    const b = to.points[0];
    meters = haversineM(a.latitude, a.longitude, b.latitude, b.longitude);
  }

  const minutes = (new Date(to.start) - new Date(from.end)) / 60000;
  const kmh = minutes > 0 ? meters / 1000 / (minutes / 60) : 0;

  return {
    meters,
    minutes,
    mode: kmh > 0 && kmh <= 6.5 ? "Walking" : "Travel",
  };
}

function totalDistance(trail) {
  let total = 0;
  for (let i = 1; i < trail.length; i += 1) {
    const d = haversineM(
      trail[i - 1].latitude,
      trail[i - 1].longitude,
      trail[i].latitude,
      trail[i].longitude,
    );
    if (d >= 10) total += d;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/*  Road snapping (OSRM / Valhalla)                                    */
/* ------------------------------------------------------------------ */

const legCache = new Map();

const OSRM_SERVERS = {
  car: [
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
    "https://router.project-osrm.org/route/v1/driving",
  ],
  foot: ["https://routing.openstreetmap.de/routed-foot/route/v1/driving"],
};

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";

function decodePolyline(str, precision = 6) {
  const factor = 10 ** precision;
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / factor, lng / factor]);
  }

  return coords;
}

async function routeOsrm(base, from, to) {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const data = await fetchJson(
    `${base}/${coords}?overview=full&geometries=geojson&radiuses=1000;1000&continue_straight=false`,
  );

  const line = data?.routes?.[0]?.geometry?.coordinates;
  if (!line || line.length < 2) throw new Error("OSRM: no route");

  return line.map(([lng, lat]) => [lat, lng]);
}

async function routeValhalla(costing, from, to) {
  const body = {
    locations: [
      { lat: from.latitude, lon: from.longitude },
      { lat: to.latitude, lon: to.longitude },
    ],
    costing,
    directions_options: { units: "kilometers" },
  };

  const data = await fetchJson(
    `${VALHALLA_URL}?json=${encodeURIComponent(JSON.stringify(body))}`,
  );

  const legs = data?.trip?.legs || [];
  const path = legs.flatMap((leg) => decodePolyline(leg.shape, 6));
  if (path.length < 2) throw new Error("Valhalla: no route");

  return path;
}

function legMode(a, b) {
  const meters = haversineM(a.latitude, a.longitude, b.latitude, b.longitude);
  const minutes = (new Date(b.recorded_at) - new Date(a.recorded_at)) / 60000;
  const kmh = minutes > 0 ? meters / 1000 / (minutes / 60) : 0;
  return kmh > 0 && kmh <= 6.5 ? "Walking" : "Travel";
}

async function fetchRoadPath(from, to, { rounds = 1 } = {}) {
  const mode = legMode(from, to);
  const walking = mode === "Walking";

  const key = `${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}>${to.latitude.toFixed(5)},${to.longitude.toFixed(5)}|${mode}`;
  if (legCache.has(key)) return legCache.get(key);

  const carAttempts = [
    ...OSRM_SERVERS.car.map((base) => () => routeOsrm(base, from, to)),
    () => routeValhalla("auto", from, to),
  ];
  const footAttempts = [
    ...OSRM_SERVERS.foot.map((base) => () => routeOsrm(base, from, to)),
    () => routeValhalla("pedestrian", from, to),
  ];

  const attempts = walking
    ? [...footAttempts, ...carAttempts]
    : [...carAttempts, ...footAttempts];

  for (let round = 0; round < rounds; round += 1) {
    for (const attempt of attempts) {
      try {
        const path = await attempt();
        legCache.set(key, path);
        return path;
      } catch (error) {
        console.warn("[EmployeeTimeline] Routing attempt failed:", error);
      }
    }

    if (round < rounds - 1) await sleep(1500);
  }

  return null;
}

const segKey = (a, b) =>
  `${a.latitude.toFixed(5)},${a.longitude.toFixed(5)}>${b.latitude.toFixed(5)},${b.longitude.toFixed(5)}`;

/* ------------------------------------------------------------------ */
/*  Place names (OpenStreetMap: Overpass + Nominatim + Photon)         */
/* ------------------------------------------------------------------ */

const PLACE_CACHE_PREFIX = "etl_place_v3:";
const EXACT_PLACE_M = 60;
const NEAR_PLACE_M = 300;
const NOMINATIM_GAP_MS = 1100;
let lastNominatimAt = 0;

const activeProvider = () => "osm";

function readPlaceCache(key) {
  try {
    const raw = localStorage.getItem(
      `${PLACE_CACHE_PREFIX}${activeProvider()}:${key}`,
    );
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function writePlaceCache(key, value) {
  try {
    localStorage.setItem(
      `${PLACE_CACHE_PREFIX}${value.provider || "osm"}:${key}`,
      JSON.stringify(value),
    );
  } catch (_error) {
    /* storage full / blocked - ignore */
  }
}

const POI_KEYS = [
  "amenity",
  "shop",
  "office",
  "tourism",
  "leisure",
  "craft",
  "healthcare",
  "historic",
];
const IGNORED_AMENITY = new Set([
  "parking",
  "parking_space",
  "parking_entrance",
  "bench",
  "waste_basket",
  "bicycle_parking",
  "motorcycle_parking",
  "toilets",
]);
const AREA_RANK = { neighbourhood: 0, quarter: 1, suburb: 2, locality: 3 };

const minVertexDistance = (el, lat, lng) =>
  Math.min(
    ...(el.geometry || []).map((g) => haversineM(lat, lng, g.lat, g.lon)),
  );

async function findOsmContext(lat, lng, radius) {
  const keys = POI_KEYS.join("|");
  const query = `
    [out:json][timeout:12];
    (
      node(around:${radius},${lat},${lng})[name][~"^(${keys})$"~"."];
      way(around:${radius},${lat},${lng})[name][~"^(${keys}|building)$"~"."];
    )->.pois;
    way(around:120,${lat},${lng})[highway][name]->.roads;
    is_in(${lat},${lng})->.a;
    area.a[place~"^(neighbourhood|quarter|suburb|locality)$"][name]->.areas;
    .pois out center tags 150;
    .roads out geom tags 40;
    .areas out tags;
  `;

  let data = null;
  let lastError = null;

  for (const endpoint of [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ]) {
    try {
      data = await fetchJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!data) throw lastError || new Error("Overpass unavailable");

  let poi = null;
  let road = null;
  let area = null;

  for (const el of data?.elements || []) {
    const tags = el.tags || {};
    const name = tags["name:en"] || tags.name;
    if (!name) continue;

    if (el.type === "area") {
      const rank = AREA_RANK[tags.place];
      if (rank !== undefined && (!area || rank < area.rank)) {
        area = { name, rank };
      }
      continue;
    }

    if (tags.highway && el.geometry) {
      const distance = minVertexDistance(el, lat, lng);
      if (!road || distance < road.distance) road = { name, distance };
      continue;
    }

    const cLat = el.lat ?? el.center?.lat;
    const cLng = el.lon ?? el.center?.lon;
    if (cLat == null || cLng == null) continue;
    if (tags.amenity && IGNORED_AMENITY.has(tags.amenity)) continue;

    const distance = haversineM(lat, lng, cLat, cLng);
    const isPoi = POI_KEYS.some((k) => tags[k]);
    const score = distance - (isPoi ? 15 : 0);

    if (!poi || score < poi.score) poi = { name, score, distance };
  }

  return {
    poi: poi ? { name: poi.name, distance: poi.distance } : null,
    road: road?.name || null,
    area: area?.name || null,
  };
}

async function reverseGeocode(lat, lng) {
  const wait = lastNominatimAt + NOMINATIM_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();

  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1&accept-language=en`,
    { headers: { Accept: "application/json" } },
  );

  return data && !data.error ? data : null;
}

const PHOTON_SKIP_KEYS = new Set([
  "highway",
  "place",
  "boundary",
  "landuse",
  "natural",
  "waterway",
]);

const POI_CATEGORIES = new Set([
  "amenity",
  "shop",
  "tourism",
  "office",
  "leisure",
  "craft",
  "healthcare",
  "historic",
  "building",
]);

async function findPhotonPlace(lat, lng, radius) {
  const data = await fetchJson(
    `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&radius=${(
      radius / 1000
    ).toFixed(3)}&limit=10&lang=en`,
  );

  for (const feature of data?.features || []) {
    const props = feature.properties || {};
    if (!props.name || PHOTON_SKIP_KEYS.has(props.osm_key)) continue;

    const [fLng, fLat] = feature.geometry?.coordinates || [];
    const distance = Number.isFinite(fLat)
      ? haversineM(lat, lng, fLat, fLng)
      : radius;

    return {
      name: props.name,
      street: props.street || null,
      area: props.district || props.locality || null,
      distance,
    };
  }

  return null;
}

async function resolvePlaceOsm(lat, lng, accuracy) {
  const exactM = Math.min(
    100,
    Math.max(EXACT_PLACE_M, Math.round(accuracy || 0)),
  );

  const [ctxResult, revResult, photonResult] = await Promise.allSettled([
    findOsmContext(lat, lng, NEAR_PLACE_M),
    reverseGeocode(lat, lng),
    findPhotonPlace(lat, lng, NEAR_PLACE_M),
  ]);

  if (photonResult.status === "rejected") {
    console.warn("[EmployeeTimeline] Photon failed:", photonResult.reason);
  }
  if (ctxResult.status === "rejected") {
    console.warn("[EmployeeTimeline] Overpass failed:", ctxResult.reason);
  }
  if (revResult.status === "rejected") {
    console.warn("[EmployeeTimeline] Nominatim failed:", revResult.reason);
  }

  const ctx = ctxResult.status === "fulfilled" ? ctxResult.value : {};
  const rev = revResult.status === "fulfilled" ? revResult.value : null;
  const photon =
    photonResult.status === "fulfilled" ? photonResult.value : null;

  if (!ctx.poi && !ctx.road && !ctx.area && !rev && !photon) return null;

  const a = rev?.address || {};
  const road =
    ctx.road || photon?.street || a.road || a.pedestrian || a.footway || a.path;
  const area =
    ctx.area ||
    photon?.area ||
    a.neighbourhood ||
    a.suburb ||
    a.quarter ||
    a.city_district ||
    a.residential;
  const city = a.city || a.town || a.village || a.county;

  const osmName = POI_CATEGORIES.has(rev?.category)
    ? rev?.namedetails?.["name:en"] || rev?.namedetails?.name || null
    : null;

  const cityLevel = new Set(
    [a.city, a.town, a.village, a.county, a.state_district, a.city_district]
      .filter(Boolean)
      .map((n) => n.toLowerCase().replace(/\s+city$/, "")),
  );
  const isCityLevel = (n) =>
    cityLevel.has(String(n).toLowerCase().replace(/\s+city$/, ""));

  const landmark = [
    ctx.poi,
    photon && { name: photon.name, distance: photon.distance },
    osmName && { name: osmName, distance: EXACT_PLACE_M / 2 },
  ]
    .filter((c) => c && !isCityLevel(c.name))
    .sort((x, y) => x.distance - y.distance)[0];

  let title;

  if (landmark) {
    title =
      landmark.distance <= exactM ? landmark.name : `Near ${landmark.name}`;
  } else {
    const local = [road, area].find((n) => n && !isCityLevel(n));
    title = local ? `Near ${local}` : city;
  }

  if (!title) return null;

  const titleCore = title.replace(/^Near /, "");

  const subtitle = [...new Set([road, area, city].filter(Boolean))]
    .filter(
      (part) => part !== titleCore && (part === city || !isCityLevel(part)),
    )
    .slice(0, 3)
    .join(", ");

  return { title, subtitle, provider: "osm" };
}

async function resolvePlace(lat, lng, accuracy) {
  try {
    return await resolvePlaceOsm(lat, lng, accuracy);
  } catch (error) {
    console.warn("[EmployeeTimeline] OpenStreetMap place lookup failed:", error);
    return null;
  }
}

const GENERIC_ADDRESSES = new Set(["gps captured", "manually added", ""]);

function fallbackAddress(stop) {
  const withAddress = stop.points.find(
    (p) =>
      p.address &&
      !GENERIC_ADDRESSES.has(String(p.address).trim().toLowerCase()),
  );
  return withAddress?.address || null;
}

/* ------------------------------------------------------------------ */
/*  Leaflet map                                                        */
/* ------------------------------------------------------------------ */

const pinIcon = (color, text, size = 30) => {
  const label = String(text);
  const fontSize = label.length > 3 ? 9 : size > 30 ? 12 : 10;

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 - 1)],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};
      border:3px solid #fff;box-sizing:border-box;box-shadow:0 1px 5px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;color:#fff;
      font:800 ${fontSize}px Arial,sans-serif">${escapeHtml(label)}</div>`,
  });
};

const dotIcon = (color) =>
  L.divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};
      border:3px solid #fff;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  });

const arrowIcon = (deg) =>
  L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;display:flex;align-items:center;justify-content:center;transform:rotate(${deg}deg)">
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:11px solid #1F4DB8;filter:drop-shadow(0 0 1px #fff)"></div></div>`,
  });

const liveIcon = () =>
  L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
    html: `<div class="etl-live-dot"><span></span></div>`,
  });

const stopPt = (stop, edge) => ({
  latitude: stop.latitude,
  longitude: stop.longitude,
  recorded_at: edge === "end" ? stop.end : stop.start,
});

function LeafletTimelineMap({
  stops,
  getPlaceLabel,
  fitSignal,
  selectedIndex,
  livePoint,
  tileMode,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const lastFitRef = useRef("");
  const lastSelectRef = useRef(null);
  const labelRef = useRef(getPlaceLabel);
  const snapCacheRef = useRef(new Map()); // segKey -> road path | null
  const [ready, setReady] = useState(false);
  const [snapVersion, setSnapVersion] = useState(0);
  const [snapping, setSnapping] = useState(false);

  labelRef.current = getPlaceLabel;

  // Create the map once
  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: [stops[0].latitude, stops[0].longitude],
      zoom: 15,
      zoomControl: true,
    });

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    setReady(true);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base tiles (Standard / India)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const cfg =
      tileMode === "india" && TILE_LAYERS.india.url
        ? TILE_LAYERS.india
        : TILE_LAYERS.standard;

    if (tileRef.current) map.removeLayer(tileRef.current);

    tileRef.current = L.tileLayer(cfg.url, {
      maxZoom: 19,
      attribution: cfg.attribution,
    }).addTo(map);

    tileRef.current.bringToBack();
  }, [ready, tileMode]);

  // Route between consecutive STOPS (already merged within 100 m) on roads.
  useEffect(() => {
    if (!ready) return undefined;

    let cancelled = false;

    (async () => {
      setSnapping(true);

      for (let i = 1; i < stops.length; i += 1) {
        if (cancelled) return;

        const a = stops[i - 1];
        const b = stops[i];
        const key = segKey(a, b);
        if (snapCacheRef.current.has(key)) continue;

        const d = haversineM(a.latitude, a.longitude, b.latitude, b.longitude);
        const path = await fetchRoadPath(stopPt(a, "end"), stopPt(b, "start"), {
          rounds: 2,
        });
        if (cancelled) return;

        const ok = path && pathLength(path) <= d * 4 + 500;
        snapCacheRef.current.set(key, ok ? path : null);
        setSnapVersion((v) => v + 1);
      }

      if (!cancelled) setSnapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, stops]);

  // Draw
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !map || !layer) return;

    layer.clearLayers();

    const bounds = L.latLngBounds([]);
    const cache = snapCacheRef.current;

    const legs = [];
    for (let i = 1; i < stops.length; i += 1) {
      legs.push(cache.get(segKey(stops[i - 1], stops[i])) || null);
    }

    // pin position: snapped onto the road, never on a building
    const pos = (i) => {
      const out = legs[i];
      if (out && out.length) return out[0];
      const inc = legs[i - 1];
      if (inc && inc.length) return inc[inc.length - 1];
      return [stops[i].latitude, stops[i].longitude];
    };

    for (let i = 1; i < stops.length; i += 1) {
      const a = stops[i - 1];
      const b = stops[i];
      const road = legs[i - 1];
      const gap = (new Date(b.start) - new Date(a.end)) / 60000;
      const d = haversineM(a.latitude, a.longitude, b.latitude, b.longitude);
      const dashed = gap > GAP_MINUTES && d > GAP_MIN_DISTANCE_M;

      if (road) {
        const pts = [pos(i - 1), ...road, pos(i)];

        if (dashed) {
          L.polyline(pts, {
            color: "#3567D6",
            weight: 4,
            opacity: 0.65,
            dashArray: "8 8",
          }).addTo(layer);
        } else {
          L.polyline(pts, {
            color: "#FFFFFF",
            weight: 9,
            opacity: 0.9,
            lineJoin: "round",
          }).addTo(layer);
          L.polyline(pts, {
            color: "#3567D6",
            weight: 6,
            opacity: 0.95,
            lineJoin: "round",
          }).addTo(layer);

          arrowsAlong(road).forEach(({ at, deg }) =>
            L.marker(at, {
              icon: arrowIcon(deg),
              interactive: false,
              keyboard: false,
            }).addTo(layer),
          );
        }

        pts.forEach((p) => bounds.extend(p));
      } else {
        // no road found (yet): thin grey dashed hint, never a solid line through buildings
        L.polyline([pos(i - 1), pos(i)], {
          color: "#969BA5",
          weight: 2,
          opacity: 0.7,
          dashArray: "4 8",
        }).addTo(layer);
      }
    }

    const popupHtml = (stop, extra) => {
      const label = labelRef.current(stop);
      return `
        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.6;min-width:170px;color:#15171C">
          <strong>${escapeHtml(label.title)}</strong>
          ${label.subtitle ? `<br/>${escapeHtml(label.subtitle)}` : ""}
          <br/>${escapeHtml(extra)}
        </div>`;
    };

    const addPin = ({ at, icon, z, html }) => {
      const marker = L.marker(at, { icon, zIndexOffset: z }).addTo(layer);
      marker.bindPopup(html());
      marker.on("click", () => marker.setPopupContent(html()));
      bounds.extend(at);
      return marker;
    };

    const stopExtra = (stop) => {
      const parts = [fmtRange(stop)];
      stop.checkins.forEach((p) =>
        parts.push(`Check-in ${fmtTime(p.recorded_at)}`),
      );
      stop.checkouts.forEach((p) =>
        parts.push(`Check-out ${fmtTime(p.recorded_at)}`),
      );
      return parts.join(" · ");
    };

    // ONE marker per stop (pings within 100 m are already merged)
    stops.forEach((stop, i) => {
      const hasIn = stop.checkins.length > 0;
      const hasOut = stop.checkouts.length > 0;

      if (hasIn || hasOut) {
        addPin({
          at: pos(i),
          icon: pinIcon(
            hasIn ? SOURCE_COLOR.checkin : SOURCE_COLOR.checkout,
            hasIn && hasOut ? "IN/OUT" : hasIn ? "IN" : "OUT",
            hasIn && hasOut ? 36 : 30,
          ),
          z: 200,
          html: () => popupHtml(stop, stopExtra(stop)),
        });
      } else {
        addPin({
          at: pos(i),
          icon: dotIcon(SOURCE_COLOR.periodic),
          z: 100,
          html: () => popupHtml(stop, stopExtra(stop)),
        });
      }
    });

    // live position = last stop, on the road
    if (livePoint && stops.length) {
      addPin({
        at: pos(stops.length - 1),
        icon: liveIcon(),
        z: 900,
        html: () =>
          `<div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.6">
            <strong>Live location</strong><br/>Last ping ${escapeHtml(fmtTime(livePoint.recorded_at))}
          </div>`,
      });
    }

    // stop selected in the activity log
    const selected = selectedIndex != null ? stops[selectedIndex] : null;

    if (selected) {
      const color = selected.checkins.length
        ? SOURCE_COLOR.checkin
        : selected.checkouts.length
          ? SOURCE_COLOR.checkout
          : SOURCE_COLOR.periodic;

      const at = pos(selectedIndex);
      const marker = addPin({
        at,
        icon: pinIcon(color, selectedIndex + 1, 38),
        z: 1000,
        html: () => popupHtml(selected, stopExtra(selected)),
      });

      marker.openPopup();

      if (lastSelectRef.current !== selectedIndex) {
        map.setView(at, Math.max(map.getZoom(), 16), { animate: true });
      }
    }

    lastSelectRef.current = selectedIndex;

    // Fit only on first draw / fit button, so live refreshes never move the map
    const fitKey = `${stops[0]?.start}|${fitSignal}`;

    if (lastFitRef.current !== fitKey) {
      lastFitRef.current = fitKey;
      map.invalidateSize();

      if (stops.length === 1) {
        map.setView(pos(0), 16);
      } else if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [
    ready,
    stops,
    fitSignal,
    selectedIndex,
    getPlaceLabel,
    snapVersion,
    livePoint,
  ]);

  return (
    <>
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%", minHeight: 300 }}
      />
      {snapping && <div className="etl-snap-note">Snapping to roads…</div>}
    </>
  );
}

function StatCard({ icon: Icon, label, value, tone = "blue" }) {
  const tones = {
    blue: { bg: "#EDF3FF", icon: "#3567D6" },
    green: { bg: "#EAF7F1", icon: "#16845B" },
    orange: { bg: "#FFF4E5", icon: "#C97816" },
    red: { bg: "#FDEEEE", icon: "#C94B4B" },
  };

  const selected = tones[tone] || tones.blue;

  return (
    <div className="etl-stat">
      <div
        className="etl-stat-icon"
        style={{ background: selected.bg, color: selected.icon }}
      >
        <Icon />
      </div>

      <div className="etl-stat-content">
        <div className="etl-stat-label">{label}</div>
        <div className="etl-stat-value">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drawer                                                             */
/* ------------------------------------------------------------------ */

export default function EmployeeTimelineDrawer({ onClose }) {
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(() => localDateStr());

  const [trail, setTrail] = useState([]);
  const [attendanceMeta, setAttendanceMeta] = useState(null);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tileMode, setTileMode] = useState(
    TILE_LAYERS.india.url ? "india" : "standard",
  );

  const [fitSignal, setFitSignal] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const [placeNames, setPlaceNames] = useState({});
  const placeNamesRef = useRef({});

  const reqRef = useRef(0);
  const trailSigRef = useRef("");

  const isToday = date === localDateStr();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/employees");
        const payload = res.data;

        const list =
          (Array.isArray(payload?.data?.employees) && payload.data.employees) ||
          (Array.isArray(payload?.data?.records) && payload.data.records) ||
          (Array.isArray(payload?.data) && payload.data) ||
          (Array.isArray(payload?.employees) && payload.employees) ||
          (Array.isArray(payload) && payload) ||
          [];

        setEmployees(list);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load employee list");
        setEmployees([]);
      } finally {
        setEmpLoading(false);
      }
    })();
  }, []);

  const loadTimeline = useCallback(
    async (silent = false) => {
      if (!employeeId || !date) return;

      let reqId = reqRef.current;

      if (!silent) {
        reqId = ++reqRef.current;
        setLoading(true);
        setSearched(true);
        setTrail([]);
        setAttendanceMeta(null);
        trailSigRef.current = "";
        setPlaceNames((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([, v]) => !v?.failed),
          ),
        );
      }

      try {
        const attRes = await attendanceAPI.getAll({
          employeeId,
          startDate: date,
          endDate: date,
          limit: 1,
        });

        if (reqId !== reqRef.current) return;

        const record = attRes.data?.data?.records?.[0];

        if (!record) {
          if (!silent) {
            toast.error("No attendance record for this employee on that date");
          }
          return;
        }

        setAttendanceMeta(record);

        const attendanceId = record.id || record._id;

        const trailRes = await api.get(
          `/attendance/${attendanceId}/location-trail`,
        );

        if (reqId !== reqRef.current) return;

        const trailPayload = trailRes.data;

        const points =
          (Array.isArray(trailPayload?.data?.points) &&
            trailPayload.data.points) ||
          (Array.isArray(trailPayload?.points) && trailPayload.points) ||
          (Array.isArray(trailPayload?.data) && trailPayload.data) ||
          [];

        const normalized = points
          .map((point) => ({
            ...point,
            latitude: toNum(point.latitude),
            longitude: toNum(point.longitude),
            accuracy_meters: toNum(point.accuracy_meters),
          }))
          .filter(
            (point) => point.latitude !== null && point.longitude !== null,
          )
          .filter(
            (point) =>
              point.source === "checkin" ||
              point.source === "checkout" ||
              point.accuracy_meters === null ||
              point.accuracy_meters <= MAX_ACCURACY_M,
          )
          .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

        const last = normalized[normalized.length - 1];
        const sig = `${normalized.length}|${last?.recorded_at}|${last?.latitude}|${last?.longitude}`;

        if (sig !== trailSigRef.current) {
          trailSigRef.current = sig;
          setTrail(normalized);
        }

        setLastUpdated(new Date());
      } catch (error) {
        console.error(error);
        if (!silent) toast.error("Failed to load location timeline");
      } finally {
        if (!silent && reqId === reqRef.current) setLoading(false);
      }
    },
    [employeeId, date],
  );

  useEffect(() => {
    if (employeeId) loadTimeline(false);
  }, [employeeId, date, loadTimeline]);

  useEffect(() => {
    if (!employeeId || !isToday || !autoRefresh) return undefined;

    const timer = setInterval(() => loadTimeline(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [employeeId, isToday, autoRefresh, loadTimeline]);

  // Pings < 100 m apart collapse into one stop. Short stays are hidden, but
  // check-in/out and the first / last stop always stay.
  const stops = useMemo(() => {
    if (!trail.length) return [];

    const indexOf = new Map();
    trail.forEach((point, i) => indexOf.set(point, i));

    const clustered = clusterTrail(trail);

    return clustered
      .filter((stop, i) => {
        const stayMin = (new Date(stop.end) - new Date(stop.start)) / 60000;
        return (
          isEventStop(stop) ||
          i === 0 ||
          i === clustered.length - 1 ||
          stayMin >= MIN_STAY_MINUTES
        );
      })
      .map((stop) => ({
        ...stop,
        firstIdx: indexOf.get(stop.points[0]),
        lastIdx: indexOf.get(stop.points[stop.points.length - 1]),
      }));
  }, [trail]);

  const totalMeters = useMemo(() => totalDistance(trail), [trail]);

  const checkInPoint = trail.find((point) => point.source === "checkin");

  const checkOutPoint = [...trail]
    .reverse()
    .find((point) => point.source === "checkout");

  const lastPoint = trail.length ? trail[trail.length - 1] : null;

  const isLive = isToday && !!lastPoint && !checkOutPoint;
  const livePoint =
    isLive && stops.length
      ? { recorded_at: stops[stops.length - 1].end }
      : null;

  const activityFeed = useMemo(() => {
    const feed = [];

    stops.forEach((stop, index) => {
      if (index > 0) {
        feed.push({
          type: "travel",
          key: `travel-${index}`,
          travel: buildTravel(stops[index - 1], stop, trail),
        });
      }

      feed.push({ type: "stop", key: `stop-${index}`, stop, index });
    });

    return feed.reverse();
  }, [stops, trail]);

  useEffect(() => {
    setSelectedIndex(null);
  }, [employeeId, date]);

  const handleSelectStop = (index) => {
    setSelectedIndex((cur) => (cur === index ? null : index));

    document
      .querySelector(".etl-map-card")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  useEffect(() => {
    placeNamesRef.current = placeNames;
  }, [placeNames]);

  useEffect(() => {
    if (!stops.length) return undefined;

    let cancelled = false;

    (async () => {
      for (const stop of [...stops].reverse()) {
        if (cancelled) return;
        if (placeNamesRef.current[stop.key]) continue;

        const cached = readPlaceCache(stop.key);

        if (cached) {
          setPlaceNames((prev) =>
            prev[stop.key] ? prev : { ...prev, [stop.key]: cached },
          );
          continue;
        }

        const resolved = await resolvePlace(
          stop.latitude,
          stop.longitude,
          stop.accuracy,
        );

        if (resolved) writePlaceCache(stop.key, resolved);

        setPlaceNames((prev) => ({
          ...prev,
          [stop.key]: resolved || { failed: true },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stops]);

  const getPlaceLabel = useCallback(
    (stop) => {
      const resolved = placeNames[stop.key];

      if (resolved && !resolved.failed) {
        return {
          title: resolved.title,
          subtitle: resolved.subtitle,
          loading: false,
        };
      }

      const address = fallbackAddress(stop);

      if (resolved?.failed) {
        return {
          title:
            address ||
            `${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}`,
          subtitle: "",
          loading: false,
        };
      }

      return {
        title: address || "Finding place name…",
        subtitle: "",
        loading: !address,
      };
    },
    [placeNames],
  );

  const selectedEmployee = employees.find(
    (employee) => String(getEmployeeId(employee)) === String(employeeId),
  );

  const status = getStatus(attendanceMeta);
  const isPresent = String(status).toLowerCase() === "present";
  const indiaAvailable = !!TILE_LAYERS.india.url;

  return (
    <>
      <style>{`
        .etl-overlay {
          position: fixed;
          inset: 0;
          z-index: 150;
          background: rgba(20,25,35,.45);
          backdrop-filter: blur(4px);
        }

        .etl-drawer {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          z-index: 151;
          background: #F6F7F9;
          color: #15171C;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          animation: etlFadeIn .18s ease;
        }

        @keyframes etlFadeIn {
          from { opacity: 0; transform: scale(.99); }
          to { opacity: 1; transform: scale(1); }
        }

        .etl-header {
          min-height: 76px;
          padding: 0 28px;
          background: #FFFFFF;
          border-bottom: 1px solid #E7E9ED;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .etl-header-left { display: flex; align-items: center; gap: 14px; min-width: 0; }

        .etl-header-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #EDF3FF;
          color: #3567D6;
          flex-shrink: 0;
        }

        .etl-header-icon svg { width: 21px; height: 21px; }

        .etl-title { font-size: 18px; font-weight: 750; letter-spacing: -.025em; color: #15171C; }
        .etl-subtitle { margin-top: 3px; font-size: 12px; color: #969BA5; }

        .etl-close {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          border: 1px solid #E7E9ED;
          background: #FFFFFF;
          color: #676C76;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background .15s ease, border-color .15s ease, color .15s ease;
        }

        .etl-close:hover { background: #FDEEEE; border-color: #F3D1D1; color: #C94B4B; }
        .etl-close svg { width: 19px; height: 19px; }

        .etl-toolbar {
          padding: 14px 28px;
          background: #FFFFFF;
          border-bottom: 1px solid #E7E9ED;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .etl-field { position: relative; }

        .etl-field-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: #969BA5;
          pointer-events: none;
        }

        .etl-select,
        .etl-date {
          height: 40px;
          padding: 0 13px 0 37px;
          border-radius: 9px;
          border: 1px solid #E1E4E9;
          background: #FAFBFC;
          color: #15171C;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }

        .etl-select { width: 300px; }
        .etl-date { width: 175px; }

        .etl-select:focus,
        .etl-date:focus {
          background: #FFFFFF;
          border-color: #9CB5EF;
          box-shadow: 0 0 0 3px #EDF3FF;
        }

        .etl-select option { color: #15171C; background: #FFFFFF; }

        .etl-employee-chip {
          margin-left: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px;
          border-radius: 8px;
          background: #F6F7F9;
          border: 1px solid #E7E9ED;
          color: #676C76;
          font-size: 12px;
        }

        .etl-chip-avatar {
          width: 22px;
          height: 22px;
          border-radius: 7px;
          background: #EDF3FF;
          color: #3567D6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
        }

        .etl-chip-name { color: #15171C; font-weight: 650; }

        .etl-toolbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

        .etl-updated { font-size: 11px; color: #969BA5; white-space: nowrap; }

        .etl-live-toggle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 34px;
          padding: 0 11px;
          border-radius: 8px;
          border: 1px solid #E7E9ED;
          background: #FFFFFF;
          color: #676C76;
          font-family: inherit;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .etl-live-toggle:disabled { opacity: .5; cursor: not-allowed; }

        .etl-live-toggle .etl-live-led {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #B8BEC9;
        }

        .etl-live-toggle.on { color: #16845B; border-color: #BFE3D2; background: #EAF7F1; }

        .etl-live-toggle.on .etl-live-led {
          background: #16845B;
          animation: etlBlink 1.4s ease-in-out infinite;
        }

        @keyframes etlBlink { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

        .etl-refresh {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          border: 1px solid #E7E9ED;
          background: #FFFFFF;
          color: #676C76;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .etl-refresh:hover { background: #FAFBFC; color: #3567D6; border-color: #CBD7F1; }
        .etl-refresh svg { width: 17px; height: 17px; }

        .etl-content {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          overflow: hidden;
        }

        .etl-left {
          min-width: 0;
          min-height: 0;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .etl-context {
          background: #FFFFFF;
          border: 1px solid #E7E9ED;
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .etl-context-left { display: flex; align-items: center; gap: 11px; min-width: 0; }

        .etl-context-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #EDF3FF;
          color: #3567D6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .etl-context-name { font-size: 13px; font-weight: 700; color: #15171C; }
        .etl-context-meta { margin-top: 3px; font-size: 11px; color: #969BA5; }

        .etl-date-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 8px;
          background: #FAFBFC;
          border: 1px solid #E7E9ED;
          color: #676C76;
          font-size: 11px;
          font-weight: 600;
        }

        .etl-date-badge svg { width: 14px; height: 14px; }

        .etl-map-card {
          position: relative;
          flex: 1;
          min-height: 0;
          background: #FFFFFF;
          border: 1px solid #E7E9ED;
          border-radius: 14px;
          overflow: hidden;
        }

        .etl-map-card .leaflet-container {
          z-index: 0;
          height: 100%;
          width: 100%;
          font-family: inherit;
        }

        .etl-map-loading,
        .etl-map-empty {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #969BA5;
          font-size: 13px;
          text-align: center;
          padding: 20px;
          background: #FAFBFC;
        }

        .etl-map-empty-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #F0F2F5;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #969BA5;
        }

        .etl-map-empty-icon svg { width: 21px; height: 21px; }

        .etl-spinner {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          border: 2px solid #E2E7EF;
          border-top-color: #3567D6;
          animation: etlSpin .7s linear infinite;
        }

        @keyframes etlSpin { to { transform: rotate(360deg); } }

        .etl-map-legend {
          position: absolute;
          z-index: 500;
          top: 12px;
          left: 58px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 8px 11px;
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(8px);
          border: 1px solid #E2E5EA;
          border-radius: 8px;
          box-shadow: 0 5px 16px rgba(20,30,50,.10);
          font-size: 10px;
        }

        .etl-legend-item { display: flex; align-items: center; gap: 5px; color: #676C76; white-space: nowrap; }
        .etl-legend-dot { width: 7px; height: 7px; border-radius: 50%; }
        .etl-legend-line { width: 18px; height: 3px; border-radius: 3px; background: #3567D6; }

        /* MAP STYLE TOGGLE (Standard / India) */

        .etl-mode-toggle {
          position: absolute;
          z-index: 500;
          top: 12px;
          right: 12px;
          display: flex;
          padding: 3px;
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(8px);
          border: 1px solid #E2E5EA;
          border-radius: 8px;
          box-shadow: 0 5px 16px rgba(20,30,50,.10);
        }

        .etl-mode-btn {
          border: none;
          background: transparent;
          color: #676C76;
          font-family: inherit;
          font-size: 11px;
          font-weight: 650;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        .etl-mode-btn:disabled { opacity: .45; cursor: not-allowed; }
        .etl-mode-btn.active { background: #EDF3FF; color: #3567D6; }

        .etl-snap-note {
          position: absolute;
          z-index: 500;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%);
          padding: 6px 12px;
          border-radius: 20px;
          background: rgba(21,23,28,.85);
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 600;
        }

        .etl-expand-map {
          position: absolute;
          z-index: 500;
          right: 12px;
          bottom: 28px;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.94);
          border: 1px solid #E2E5EA;
          border-radius: 8px;
          color: #676C76;
          box-shadow: 0 5px 16px rgba(20,30,50,.10);
          cursor: pointer;
        }

        .etl-expand-map:hover { color: #3567D6; }
        .etl-expand-map svg { width: 16px; height: 16px; }

        .etl-live-dot { width: 22px; height: 22px; position: relative; }

        .etl-live-dot span {
          position: absolute;
          inset: 3px;
          z-index: 2;
          border-radius: 50%;
          background: #16845B;
          border: 3px solid #FFFFFF;
          box-shadow: 0 1px 5px rgba(0,0,0,.35);
          box-sizing: border-box;
        }

        .etl-live-dot::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(22,132,91,.35);
          animation: etlPulse 1.6s ease-out infinite;
        }

        @keyframes etlPulse {
          0% { transform: scale(.7); opacity: .9; }
          100% { transform: scale(2.3); opacity: 0; }
        }

        .etl-right {
          min-height: 0;
          background: #FFFFFF;
          border-left: 1px solid #E7E9ED;
          overflow-y: auto;
          padding: 20px;
        }

        .etl-right-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 15px;
        }

        .etl-section-title { font-size: 13px; font-weight: 750; color: #15171C; }
        .etl-section-subtitle { margin-top: 3px; font-size: 10px; color: #969BA5; }

        .etl-point-count {
          min-width: 30px;
          height: 25px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: #EDF3FF;
          color: #3567D6;
          font-size: 11px;
          font-weight: 700;
        }

        .etl-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }

        .etl-stat {
          min-height: 62px;
          padding: 10px;
          border: 1px solid #E7E9ED;
          border-radius: 10px;
          background: #FAFBFC;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .etl-stat-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .etl-stat-icon svg { width: 15px; height: 15px; }

        .etl-stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #969BA5; }
        .etl-stat-value { margin-top: 3px; color: #15171C; font-size: 13px; font-weight: 700; }

        .etl-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 12px;
          margin-bottom: 18px;
          border-radius: 9px;
          background: #FAFBFC;
          border: 1px solid #E7E9ED;
        }

        .etl-status-left { display: flex; align-items: center; gap: 8px; }
        .etl-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #16845B; }
        .etl-status-label { font-size: 11px; color: #676C76; }
        .etl-status-value { font-size: 11px; font-weight: 750; color: #16845B; text-transform: capitalize; }

        .etl-badge {
          display: inline-flex;
          align-items: center;
          height: 21px;
          padding: 0 7px;
          border-radius: 5px;
          font-size: 9px;
          font-weight: 750;
        }

        .etl-empty-timeline {
          padding: 30px 10px;
          text-align: center;
          color: #969BA5;
          font-size: 12px;
          border: 1px dashed #E2E5EA;
          border-radius: 10px;
          background: #FAFBFC;
        }

        @media(max-width: 1050px) {
          .etl-content { grid-template-columns: minmax(0, 1fr) 340px; }
          .etl-select { width: 250px; }
        }

        @media(max-width: 900px) {
          .etl-content {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(440px, 58vh) auto;
            overflow-y: auto;
          }

          .etl-right { border-left: none; border-top: 1px solid #E7E9ED; overflow: visible; }
          .etl-map-card { min-height: 420px; }
        }

        @media(max-width: 650px) {
          .etl-header { min-height: 68px; padding: 0 14px; }
          .etl-header-icon { width: 36px; height: 36px; }
          .etl-title { font-size: 16px; }
          .etl-subtitle { font-size: 10px; }

          .etl-toolbar { padding: 10px 14px; flex-direction: column; align-items: stretch; }

          .etl-field,
          .etl-select,
          .etl-date { width: 100%; }

          .etl-employee-chip { margin-left: 0; }
          .etl-toolbar-right { margin-left: 0; justify-content: space-between; }
          .etl-left { padding: 10px; }
          .etl-context { padding: 11px; }
          .etl-date-badge { display: none; }
          .etl-map-card { min-height: 390px; }

          .etl-map-legend { gap: 7px; padding: 7px 8px; font-size: 9px; top: 56px; left: 10px; }
          .etl-right { padding: 16px; }
        }

        /* ACTIVITY LOG */

        .etl-gt { display: flex; flex-direction: column; }
        .etl-gt-row { display: flex; gap: 12px; position: relative; }

        .etl-gt-rail {
          width: 30px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .etl-gt-rail::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 2px;
          margin-left: -1px;
          background: #E1E4EA;
        }

        .etl-gt-row:first-child .etl-gt-rail::before { top: 15px; }
        .etl-gt-row:last-child .etl-gt-rail::before { bottom: calc(100% - 15px); }

        .etl-gt-dot {
          position: relative;
          z-index: 2;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid #FFFFFF;
          box-sizing: border-box;
          box-shadow: 0 1px 4px rgba(20,30,50,.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 800;
          flex-shrink: 0;
          transition: transform .15s ease, box-shadow .15s ease;
        }

        .etl-gt-body { flex: 1; min-width: 0; padding-bottom: 18px; }

        .etl-gt-title { font-size: 13px; font-weight: 700; line-height: 1.35; color: #15171C; word-break: break-word; }
        .etl-gt-title.loading { font-weight: 500; color: #969BA5; font-style: italic; }

        .etl-gt-sub { margin-top: 1px; font-size: 11px; line-height: 1.4; color: #7A808B; word-break: break-word; }

        .etl-gt-time {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          font-size: 11px;
          color: #5B6270;
          font-weight: 600;
          flex-wrap: wrap;
        }

        .etl-gt-time svg { width: 12px; height: 12px; color: #969BA5; }

        .etl-gt-stay {
          margin-left: 4px;
          padding: 1px 7px;
          border-radius: 20px;
          background: #EDF3FF;
          color: #3567D6;
          font-size: 10px;
          font-weight: 700;
        }

        .etl-gt-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }

        .etl-gt-travel { align-items: center; min-height: 34px; }
        .etl-gt-travel .etl-gt-rail { justify-content: center; }

        .etl-gt-travel-icon {
          position: relative;
          z-index: 2;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 2px solid #CBD1DA;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7A808B;
        }

        .etl-gt-travel-icon svg { width: 10px; height: 10px; transform: rotate(90deg); }

        .etl-gt-travel-text {
          display: flex;
          flex-direction: column;
          font-size: 11px;
          font-weight: 600;
          color: #5B6270;
          padding: 4px 0;
        }

        .etl-gt-travel-text span { font-weight: 500; color: #969BA5; }

        .etl-gt-row.clickable { cursor: pointer; }
        .etl-gt-row.clickable:hover .etl-gt-title { color: #3567D6; }
        .etl-gt-row.selected .etl-gt-title { color: #3567D6; }

        .etl-gt-row.selected .etl-gt-dot {
          transform: scale(1.15);
          box-shadow: 0 0 0 4px rgba(53,103,214,.25);
        }
      `}</style>

      <div className="etl-overlay" onClick={onClose} />

      <div className="etl-drawer">
        <div className="etl-header">
          <div className="etl-header-left">
            <div className="etl-header-icon">
              <MapPinIcon />
            </div>

            <div>
              <div className="etl-title">Employee Movement</div>
              <div className="etl-subtitle">
                Attendance location and movement history
              </div>
            </div>
          </div>

          <button
            className="etl-close"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <XMarkIcon />
          </button>
        </div>

        <div className="etl-toolbar">
          <div className="etl-field">
            <UserIcon className="etl-field-icon" />

            <select
              className="etl-select"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={empLoading}
            >
              <option value="">
                {empLoading ? "Loading employees..." : "Select employee"}
              </option>

              {employees.map((employee) => {
                const id = getEmployeeId(employee);
                const code = getEmployeeCode(employee);

                return (
                  <option key={id} value={id}>
                    {employee.name}
                    {code ? ` (${code})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="etl-field">
            <CalendarDaysIcon className="etl-field-icon" />

            <input
              type="date"
              className="etl-date"
              value={date}
              max={localDateStr()}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          {selectedEmployee && (
            <div className="etl-employee-chip">
              <div className="etl-chip-avatar">
                {selectedEmployee.name?.charAt(0)?.toUpperCase() || "E"}
              </div>

              <span>Viewing</span>

              <span className="etl-chip-name">{selectedEmployee.name}</span>
            </div>
          )}

          <div className="etl-toolbar-right">
            {lastUpdated && employeeId && (
              <span className="etl-updated">
                Updated {fmtTimeSec(lastUpdated)}
              </span>
            )}

            <button
              type="button"
              className={`etl-live-toggle ${isToday && autoRefresh ? "on" : ""}`}
              onClick={() => setAutoRefresh((v) => !v)}
              disabled={!isToday}
              title={
                isToday
                  ? "Refresh automatically every 20 seconds"
                  : "Live updates are only available for today"
              }
            >
              <span className="etl-live-led" />
              {isToday && autoRefresh ? "Live" : "Paused"}
            </button>

            <button
              type="button"
              className="etl-refresh"
              onClick={() => loadTimeline(false)}
              disabled={!employeeId || loading}
              title="Refresh movement data"
            >
              <ArrowPathIcon
                style={{
                  animation: loading ? "etlSpin .8s linear infinite" : "none",
                }}
              />
            </button>
          </div>
        </div>

        <div className="etl-content">
          <div className="etl-left">
            {selectedEmployee && (
              <div className="etl-context">
                <div className="etl-context-left">
                  <div className="etl-context-avatar">
                    {selectedEmployee.name
                      ?.split(" ")
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase() || "E"}
                  </div>

                  <div>
                    <div className="etl-context-name">
                      {selectedEmployee.name}
                    </div>

                    <div className="etl-context-meta">
                      {getEmployeeCode(selectedEmployee) || "Employee"}{" "}
                      {selectedEmployee.department
                        ? `• ${selectedEmployee.department}`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="etl-date-badge">
                  <CalendarDaysIcon />
                  {fmtDate(date)}
                </div>
              </div>
            )}

            <div className="etl-map-card">
              {loading ? (
                <div className="etl-map-loading">
                  <div className="etl-spinner" />
                  <span>Loading movement history...</span>
                </div>
              ) : stops.length === 0 ? (
                <div className="etl-map-empty">
                  <div className="etl-map-empty-icon">
                    <MapPinIcon />
                  </div>

                  <div>
                    {!searched
                      ? "Select an employee to view their movement history"
                      : "No location points recorded for this day"}
                  </div>
                </div>
              ) : (
                <>
                  <div className="etl-map-legend">
                    <div className="etl-legend-item">
                      <span
                        className="etl-legend-dot"
                        style={{ background: SOURCE_COLOR.checkin }}
                      />
                      Check-in
                    </div>

                    <div className="etl-legend-item">
                      <span
                        className="etl-legend-dot"
                        style={{ background: SOURCE_COLOR.checkout }}
                      />
                      Check-out
                    </div>

                    <div className="etl-legend-item">
                      <span className="etl-legend-line" />
                      Movement
                    </div>
                  </div>

                  <div className="etl-mode-toggle">
                    <button
                      type="button"
                      className={`etl-mode-btn ${tileMode === "standard" ? "active" : ""}`}
                      onClick={() => setTileMode("standard")}
                      title="OpenStreetMap standard map"
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      className={`etl-mode-btn ${tileMode === "india" ? "active" : ""}`}
                      onClick={() => setTileMode("india")}
                      disabled={!indiaAvailable}
                      title={
                        indiaAvailable
                          ? "Map with India's official boundary"
                          : "Set INDIA_TILE_URL (or REACT_APP_INDIA_TILE_URL) to enable the India map"
                      }
                    >
                      India
                    </button>
                  </div>

                  <button
                    type="button"
                    className="etl-expand-map"
                    title="Fit movement trail"
                    onClick={() => setFitSignal((n) => n + 1)}
                  >
                    <ArrowsPointingOutIcon />
                  </button>

                  <LeafletTimelineMap
                    stops={stops}
                    getPlaceLabel={getPlaceLabel}
                    fitSignal={fitSignal}
                    selectedIndex={selectedIndex}
                    livePoint={livePoint}
                    tileMode={tileMode}
                  />
                </>
              )}
            </div>
          </div>

          <aside className="etl-right">
            <div className="etl-right-header">
              <div>
                <div className="etl-section-title">Movement history</div>
                <div className="etl-section-subtitle">
                  {isToday ? "Places visited today" : "Places visited"}
                </div>
              </div>

              <div className="etl-point-count">{stops.length}</div>
            </div>

            {attendanceMeta && (
              <>
                <div className="etl-summary">
                  <StatCard
                    icon={CheckCircleIcon}
                    label="Status"
                    value={getStatus(attendanceMeta)}
                    tone={isPresent ? "green" : "blue"}
                  />

                  <StatCard
                    icon={MapPinIcon}
                    label="Places visited"
                    value={stops.length}
                    tone="blue"
                  />

                  <StatCard
                    icon={ClockIcon}
                    label="Working hours"
                    value={getWorkingHours(attendanceMeta)}
                    tone="orange"
                  />

                  <StatCard
                    icon={ArrowRightIcon}
                    label="Overtime"
                    value={getOvertime(attendanceMeta)}
                    tone="green"
                  />

                  <StatCard
                    icon={ArrowsPointingOutIcon}
                    label="Distance"
                    value={fmtDistance(totalMeters) || "0 m"}
                    tone="blue"
                  />

                  <StatCard
                    icon={SignalIcon}
                    label="Last ping"
                    value={lastPoint ? fmtTime(lastPoint.recorded_at) : "—"}
                    tone="orange"
                  />
                </div>

                <div className="etl-status">
                  <div className="etl-status-left">
                    <span className="etl-status-dot" />
                    <span className="etl-status-label">Attendance status</span>
                  </div>

                  <span className="etl-status-value">
                    {getStatus(attendanceMeta)}
                  </span>
                </div>
              </>
            )}

            {!attendanceMeta && (
              <div className="etl-empty-timeline">
                Select an employee and date to view attendance activity.
              </div>
            )}

            {stops.length > 0 && (
              <>
                <div className="etl-right-header">
                  <div>
                    <div className="etl-section-title">Activity log</div>

                    <div className="etl-section-subtitle">
                      Latest activity first · names from OpenStreetMap
                      {Object.values(placeNames).some((v) => v?.failed) &&
                        " · some names could not be loaded"}
                    </div>
                  </div>
                </div>

                <div className="etl-gt">
                  {activityFeed.map((item) => {
                    if (item.type === "travel") {
                      const { travel } = item;

                      return (
                        <div key={item.key} className="etl-gt-row etl-gt-travel">
                          <div className="etl-gt-rail">
                            <div className="etl-gt-travel-icon">
                              <ArrowRightIcon />
                            </div>
                          </div>

                          <div className="etl-gt-travel-text">
                            {travel.mode}
                            <span>
                              {fmtDistance(travel.meters)} ·{" "}
                              {fmtDuration(travel.minutes)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const { stop, index } = item;
                    const label = getPlaceLabel(stop);
                    const hasIn = stop.checkins.length > 0;
                    const hasOut = stop.checkouts.length > 0;
                    const isCurrent = isLive && index === stops.length - 1;
                    const dotColor = hasIn
                      ? SOURCE_COLOR.checkin
                      : hasOut
                        ? SOURCE_COLOR.checkout
                        : SOURCE_COLOR.periodic;

                    const sameTime = stop.start === stop.end;
                    const stayMinutes =
                      (new Date(stop.end) - new Date(stop.start)) / 60000;

                    return (
                      <div
                        key={item.key}
                        className={`etl-gt-row clickable ${
                          selectedIndex === index ? "selected" : ""
                        }`}
                        onClick={() => handleSelectStop(index)}
                      >
                        <div className="etl-gt-rail">
                          <div
                            className="etl-gt-dot"
                            style={{ background: dotColor }}
                          >
                            {hasIn && hasOut
                              ? "I/O"
                              : hasIn
                                ? "IN"
                                : hasOut
                                  ? "OUT"
                                  : index + 1}
                          </div>
                        </div>

                        <div className="etl-gt-body">
                          <div
                            className={`etl-gt-title ${
                              label.loading ? "loading" : ""
                            }`}
                          >
                            {label.title}
                          </div>

                          {label.subtitle && (
                            <div className="etl-gt-sub">{label.subtitle}</div>
                          )}

                          <div className="etl-gt-time">
                            <ClockIcon />

                            {sameTime
                              ? fmtTime(stop.start)
                              : `${fmtTime(stop.start)} – ${fmtTime(stop.end)}`}

                            {!sameTime && stayMinutes >= 1 && (
                              <span className="etl-gt-stay">
                                {fmtDuration(stayMinutes)}
                              </span>
                            )}
                          </div>

                          {(hasIn || hasOut || isCurrent) && (
                            <div className="etl-gt-chips">
                              {isCurrent && (
                                <span
                                  className="etl-badge"
                                  style={{
                                    color: SOURCE_COLOR.checkin,
                                    background: `${SOURCE_COLOR.checkin}12`,
                                    border: `1px solid ${SOURCE_COLOR.checkin}28`,
                                  }}
                                >
                                  Here now
                                </span>
                              )}

                              {stop.checkins.map((point, i) => (
                                <span
                                  key={`in-${i}`}
                                  className="etl-badge"
                                  style={{
                                    color: SOURCE_COLOR.checkin,
                                    background: `${SOURCE_COLOR.checkin}12`,
                                    border: `1px solid ${SOURCE_COLOR.checkin}28`,
                                  }}
                                >
                                  Check-in {fmtTime(point.recorded_at)}
                                </span>
                              ))}

                              {stop.checkouts.map((point, i) => (
                                <span
                                  key={`out-${i}`}
                                  className="etl-badge"
                                  style={{
                                    color: SOURCE_COLOR.checkout,
                                    background: `${SOURCE_COLOR.checkout}12`,
                                    border: `1px solid ${SOURCE_COLOR.checkout}28`,
                                  }}
                                >
                                  Check-out {fmtTime(point.recorded_at)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {stops.length === 0 && attendanceMeta && (
              <div className="etl-empty-timeline">
                No location points were recorded for this day.
              </div>
            )}

            {checkInPoint && (
              <div
                style={{
                  marginTop: 20,
                  padding: 12,
                  border: "1px solid #E7E9ED",
                  borderRadius: 10,
                  background: "#FAFBFC",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 10,
                    color: "#969BA5",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    fontWeight: 700,
                  }}
                >
                  <SignalIcon style={{ width: 13, height: 13 }} />
                  Attendance events
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 9, color: "#969BA5" }}>Check-in</div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#16845B",
                      }}
                    >
                      <CheckCircleIcon style={{ width: 14, height: 14 }} />
                      {fmtTime(checkInPoint.recorded_at)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 9, color: "#969BA5" }}>
                      Check-out
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        color: checkOutPoint ? "#C94B4B" : "#969BA5",
                      }}
                    >
                      <ArrowLeftOnRectangleIcon
                        style={{ width: 14, height: 14 }}
                      />

                      {checkOutPoint
                        ? fmtTime(checkOutPoint.recorded_at)
                        : "Not recorded"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}