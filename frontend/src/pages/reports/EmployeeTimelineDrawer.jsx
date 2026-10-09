import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

import toast from "react-hot-toast";
import api, { attendanceAPI } from "../../services/api";

function toNum(value) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

const SOURCE_COLOR = {
  checkin: "#16845B",
  checkout: "#C94B4B",
  periodic: "#3567D6",
};

const SOURCE_LABEL = {
  checkin: "Check-in",
  checkout: "Check-out",
  periodic: "Location ping",
};

function fmtTime(iso) {
  return iso
    ? new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
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


/* ------------------------------------------------------------------ */
/*  Google-Timeline style stops: merge pings that are < 100 m apart    */
/* ------------------------------------------------------------------ */

const STOP_RADIUS_M = 100;

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

/**
 * Walks the (time-sorted) trail and groups consecutive pings that stay
 * within STOP_RADIUS_M of the stop's centre. A ping 100 m or more away
 * starts a new stop.
 */
function clusterTrail(points, radius = STOP_RADIUS_M) {
  let groups = [];
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

  // Noise filter: a short, check-in/out-free blip sitting between two
  // groups that are themselves < radius apart is GPS jitter, not a visit.
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
        groups.splice(
          i - 1,
          3,
          [...groups[i - 1], ...blip, ...groups[i + 1]],
        );
        changed = true;
        break;
      }
    }
  }

  return groups.map(buildStop);
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

function buildTravel(from, to) {
  const a = from.points[from.points.length - 1];
  const b = to.points[0];
  const meters = haversineM(a.latitude, a.longitude, b.latitude, b.longitude);
  const minutes = (new Date(to.start) - new Date(from.end)) / 60000;
  const kmh = minutes > 0 ? meters / 1000 / (minutes / 60) : 0;

  return {
    meters,
    minutes,
    mode: kmh > 0 && kmh <= 6.5 ? "Walking" : "Travel",
  };
}

/* ------------------------------------------------------------------ */
/*  Place names (OpenStreetMap - same data the map tiles are drawn from) */
/* ------------------------------------------------------------------ */

// Put VITE_GOOGLE_MAPS_API_KEY in frontend/.env.local to switch the map and
// the place names to Google. Without a key (or if Google rejects it) the
// OpenStreetMap map + names below are used automatically.
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
let googleBroken = false;
let googleLoader = null;

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_KEY || googleBroken) {
    return Promise.reject(new Error("Google Maps not available"));
  }

  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google);
  if (googleLoader) return googleLoader;

  googleLoader = new Promise((resolve, reject) => {
    // Google calls this when the key is invalid / API not enabled / billing off
    window.gm_authFailure = () => {
      googleBroken = true;
      window.dispatchEvent(new Event("etl-gmaps-failure"));
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_KEY,
    )}&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      googleBroken = true;
      googleLoader = null;
      window.dispatchEvent(new Event("etl-gmaps-failure"));
      reject(new Error("Could not load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return googleLoader;
}

async function googleLib(name) {
  await loadGoogleMaps();
  return window.google.maps.importLibrary(name);
}

const PLACE_CACHE_PREFIX = "etl_place_v2:";
const NOMINATIM_GAP_MS = 1100; // Nominatim usage policy: max 1 request/second
let lastNominatimAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const activeProvider = () =>
  GOOGLE_MAPS_KEY && !googleBroken ? "google" : "osm";

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

const POI_KEYS = ["amenity", "shop", "office", "tourism", "leisure", "craft", "healthcare"];
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
const GENERIC_OSM_TYPES = new Set([
  "city",
  "town",
  "village",
  "county",
  "state",
  "state_district",
  "country",
  "municipality",
  "administrative",
]);

const minVertexDistance = (el, lat, lng) =>
  Math.min(
    ...(el.geometry || []).map((g) => haversineM(lat, lng, g.lat, g.lon)),
  );

/**
 * One Overpass round-trip returns the nearest named shop/restaurant/office/
 * building, the nearest named road, and the local area (neighbourhood/suburb)
 * the point lies in.
 */
async function findOsmContext(lat, lng, radius) {
  const keys = "amenity|shop|office|tourism|leisure|craft|healthcare";
  const query = `
    [out:json][timeout:12];
    (
      node(around:${radius},${lat},${lng})[name][~"^(${keys})$"~"."];
      way(around:${radius},${lat},${lng})[name][~"^(${keys}|building)$"~"."];
    )->.pois;
    way(around:120,${lat},${lng})[highway][name]->.roads;
    is_in(${lat},${lng})->.a;
    area.a[place~"^(neighbourhood|quarter|suburb|locality)$"][name]->.areas;
    .pois out center tags 60;
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

    if (!poi || score < poi.score) poi = { name, score };
  }

  return {
    poi: poi?.name || null,
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

/** Photon (OpenStreetMap search): nearest named feature around the point. */
async function findPhotonPlace(lat, lng, radius) {
  const data = await fetchJson(
    `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&radius=${(
      radius / 1000
    ).toFixed(3)}&limit=8&lang=en`,
  );

  for (const feature of data?.features || []) {
    const props = feature.properties || {};
    if (!props.name || PHOTON_SKIP_KEYS.has(props.osm_key)) continue;

    return {
      name: props.name,
      street: props.street || null,
      area: props.district || props.locality || null,
    };
  }

  return null;
}

async function resolvePlaceOsm(lat, lng, accuracy) {
  const radius = Math.min(100, Math.max(50, Math.round(accuracy || 0)));

  const [ctxResult, revResult, photonResult] = await Promise.allSettled([
    findOsmContext(lat, lng, radius),
    reverseGeocode(lat, lng),
    findPhotonPlace(lat, lng, radius),
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

  // Only trust Nominatim's own name when the hit is a real shop/office/
  // building. City/ward boundaries ("Indore City") say nothing local.
  const osmName = POI_CATEGORIES.has(rev?.category)
    ? rev?.namedetails?.["name:en"] || rev?.namedetails?.name || null
    : null;

  // Anything that is just the city / district again is not a local name
  const cityLevel = new Set(
    [a.city, a.town, a.village, a.county, a.state_district, a.city_district]
      .filter(Boolean)
      .map((n) => n.toLowerCase().replace(/\s+city$/, "")),
  );
  const isCityLevel = (n) =>
    cityLevel.has(String(n).toLowerCase().replace(/\s+city$/, ""));

  const candidates = [ctx.poi, photon?.name, osmName, road, area].filter(
    (n) => n && !isCityLevel(n),
  );

  const title = candidates[0] || city;
  if (!title) return null;

  const subtitle = [...new Set([road, area, city].filter(Boolean))]
    .filter((part) => part !== title && (part === city || !isCityLevel(part)))
    .slice(0, 3)
    .join(", ");

  return { title, subtitle, provider: "osm" };
}

/** Google Places (nearest business / landmark) + Geocoder (area, road). */
async function resolvePlaceGoogle(lat, lng, accuracy) {
  const radius = Math.min(100, Math.max(40, Math.round(accuracy || 0)));

  let poiName = null;
  let comps = null;

  try {
    const { Place } = await googleLib("places");
    const rank =
      window.google.maps.places?.SearchNearbyRankPreference?.DISTANCE ||
      "DISTANCE";

    const { places } = await Place.searchNearby({
      fields: ["displayName", "location"],
      locationRestriction: { center: { lat, lng }, radius },
      maxResultCount: 10,
      rankPreference: rank,
    });

    const nearest = (places || []).find((place) => {
      if (!place.displayName || !place.location) return false;
      return (
        haversineM(lat, lng, place.location.lat(), place.location.lng()) <=
        radius
      );
    });

    poiName = nearest?.displayName || null;
  } catch (_error) {
    /* Places API (New) not enabled - still try the geocoder */
  }

  try {
    const { Geocoder } = await googleLib("geocoding");
    const { results } = await new Geocoder().geocode({
      location: { lat, lng },
    });
    comps = results?.[0]?.address_components || null;
  } catch (_error) {
    /* ignore */
  }

  if (!poiName && !comps) throw new Error("Google lookup failed");

  const pick = (...types) =>
    comps?.find((c) => types.some((t) => c.types.includes(t)))?.long_name ||
    null;

  const route = pick("route");
  const road = route && !/^unnamed/i.test(route) ? route : null;
  const area2 = pick("sublocality_level_2", "neighborhood");
  const area1 = pick("sublocality_level_1", "sublocality");
  const city = pick("locality", "administrative_area_level_2");

  const title =
    poiName || pick("premise", "point_of_interest") || road || area2 || area1 || city;
  if (!title) throw new Error("Google lookup failed");

  const subtitle = [...new Set([road, area2, area1, city].filter(Boolean))]
    .filter((part) => part !== title)
    .slice(0, 3)
    .join(", ");

  return { title, subtitle, provider: "google" };
}

/** Returns { title, subtitle, provider } for a coordinate, or null. */
async function resolvePlace(lat, lng, accuracy) {
  if (GOOGLE_MAPS_KEY && !googleBroken) {
    try {
      return await resolvePlaceGoogle(lat, lng, accuracy);
    } catch (error) {
      console.warn("[EmployeeTimeline] Google place lookup failed:", error);
    }
  }

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
      p.address && !GENERIC_ADDRESSES.has(String(p.address).trim().toLowerCase()),
  );
  return withAddress?.address || null;
}

function eventIcon(color, type) {
  const label = type === "checkin" ? "IN" : "OUT";

  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width:36px;
          height:36px;
          border-radius:50%;
          background:#ffffff;
          border:3px solid ${color};
          box-shadow:
            0 3px 10px rgba(20,30,50,.22),
            0 0 0 5px ${color}18;
          display:flex;
          align-items:center;
          justify-content:center;
          color:${color};
          font-size:9px;
          font-weight:800;
          font-family:Arial,sans-serif;
        "
      >
        ${label}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}


function stopIcon(number) {
  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width:26px;
          height:26px;
          border-radius:50%;
          background:#3567D6;
          border:3px solid #ffffff;
          box-shadow:0 2px 8px rgba(20,30,50,.3);
          display:flex;
          align-items:center;
          justify-content:center;
          color:#ffffff;
          font-size:11px;
          font-weight:800;
          font-family:Arial,sans-serif;
        "
      >
        ${number}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  });
}


const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function GoogleTimelineMap({
  stops,
  eventPoints,
  stopByPoint,
  getPlaceLabel,
  onFailure,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef({ markers: [], line: null, info: null });
  const labelRef = useRef(getPlaceLabel);
  const [ready, setReady] = useState(false);

  labelRef.current = getPlaceLabel;

  // Create the map once
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ Map, InfoWindow }] = await Promise.all([
          googleLib("maps"),
          googleLib("marker"),
          googleLib("core"),
        ]);

        if (cancelled || !containerRef.current) return;

        mapRef.current = new Map(containerRef.current, {
          center: { lat: stops[0].latitude, lng: stops[0].longitude },
          zoom: 15,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });

        overlaysRef.current.info = new InfoWindow();
        setReady(true);
      } catch (_error) {
        if (!cancelled) onFailure?.();
      }
    })();

    return () => {
      cancelled = true;
      overlaysRef.current.markers.forEach((m) => m.setMap(null));
      overlaysRef.current.line?.setMap(null);
      overlaysRef.current.markers = [];
      overlaysRef.current.line = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw stops, route and markers whenever the trail changes
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const { maps } = window.google;
    const map = mapRef.current;
    const overlays = overlaysRef.current;

    overlays.markers.forEach((m) => m.setMap(null));
    overlays.line?.setMap(null);
    overlays.markers = [];

    const path = stops.map((s) => ({ lat: s.latitude, lng: s.longitude }));

    overlays.line = new maps.Polyline({
      path,
      map,
      strokeColor: "#3567D6",
      strokeOpacity: 0.85,
      strokeWeight: 4,
      icons: [
        {
          icon: {
            path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: "#1F4DB8",
            fillColor: "#1F4DB8",
            fillOpacity: 1,
          },
          offset: "50%",
          repeat: "140px",
        },
      ],
    });

    const addMarker = ({ lat, lng, color, text, zIndex, html }) => {
      const marker = new maps.Marker({
        position: { lat, lng },
        map,
        zIndex,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 3,
        },
        label: {
          text: String(text),
          color: "#FFFFFF",
          fontSize: "10px",
          fontWeight: "800",
        },
      });

      marker.addListener("click", () => {
        overlays.info.setContent(html());
        overlays.info.open({ map, anchor: marker });
      });

      overlays.markers.push(marker);
    };

    const infoHtml = (stop, extra) => {
      const label = labelRef.current(stop);

      return `
        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.6;min-width:170px;color:#15171C">
          <strong>${escapeHtml(label.title)}</strong>
          ${label.subtitle ? `<br/>${escapeHtml(label.subtitle)}` : ""}
          <br/>${escapeHtml(extra)}
        </div>`;
    };

    stops.forEach((stop, index) => {
      if (isEventStop(stop)) return;

      addMarker({
        lat: stop.latitude,
        lng: stop.longitude,
        color: SOURCE_COLOR.periodic,
        text: index + 1,
        zIndex: 10,
        html: () =>
          infoHtml(
            stop,
            stop.end === stop.start
              ? fmtTime(stop.start)
              : `${fmtTime(stop.start)} – ${fmtTime(stop.end)}`,
          ),
      });
    });

    eventPoints.forEach((point) => {
      const isIn = point.source === "checkin";
      const owner = stopByPoint.get(point);

      addMarker({
        lat: point.latitude,
        lng: point.longitude,
        color: isIn ? SOURCE_COLOR.checkin : SOURCE_COLOR.checkout,
        text: isIn ? "IN" : "OUT",
        zIndex: 20,
        html: () =>
          owner
            ? infoHtml(
                owner.stop,
                `${isIn ? "Check-in" : "Check-out"} · ${fmtTime(point.recorded_at)}`,
              )
            : `${isIn ? "Check-in" : "Check-out"} · ${escapeHtml(
                fmtTime(point.recorded_at),
              )}`,
      });
    });

    if (path.length === 1) {
      map.setCenter(path[0]);
      map.setZoom(16);
    } else {
      const bounds = new maps.LatLngBounds();
      path.forEach((position) => bounds.extend(position));
      map.fitBounds(bounds, 70);
    }
  }, [ready, stops, eventPoints, stopByPoint]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%", minHeight: 300 }}
    />
  );
}

function FitToPoints({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 16);
    } else {
      map.fitBounds(
        points.map((point) => [point.latitude, point.longitude]),
        {
          padding: [70, 70],
        },
      );
    }
  }, [points, map]);

  return null;
}

function DirectionArrows({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length < 2) return;

    const arrowLayer = L.layerGroup();

    const step = Math.max(1, Math.floor(points.length / 12));

    for (let i = 0; i < points.length - 1; i += step) {
      const from = points[i];
      const to = points[i + 1];

      if (
        from.latitude == null ||
        from.longitude == null ||
        to.latitude == null ||
        to.longitude == null
      ) {
        continue;
      }

      const angle =
        (Math.atan2(
          to.longitude - from.longitude,
          to.latitude - from.latitude,
        ) *
          180) /
        Math.PI;

      const arrow = L.marker(
        [
          (from.latitude + to.latitude) / 2,
          (from.longitude + to.longitude) / 2,
        ],
        {
          icon: L.divIcon({
            className: "",
            html: `
              <div
                style="
                  width:20px;
                  height:20px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  transform:rotate(${angle}deg);
                  pointer-events:none;
                "
              >
                <div
                  style="
                    width:0;
                    height:0;
                    border-top:5px solid transparent;
                    border-bottom:5px solid transparent;
                    border-left:8px solid #3567D6;
                    filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));
                  "
                ></div>
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          interactive: false,
        },
      );

      arrowLayer.addLayer(arrow);
    }

    arrowLayer.addTo(map);

    return () => {
      arrowLayer.removeFrom(map);
    };
  }, [map, points]);

  return null;
}

function StatCard({ icon: Icon, label, value, tone = "blue" }) {
  const tones = {
    blue: {
      bg: "#EDF3FF",
      icon: "#3567D6",
    },
    green: {
      bg: "#EAF7F1",
      icon: "#16845B",
    },
    orange: {
      bg: "#FFF4E5",
      icon: "#C97816",
    },
    red: {
      bg: "#FDEEEE",
      icon: "#C94B4B",
    },
  };

  const selected = tones[tone] || tones.blue;

  return (
    <div className="etl-stat">
      <div
        className="etl-stat-icon"
        style={{
          background: selected.bg,
          color: selected.icon,
        }}
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

export default function EmployeeTimelineDrawer({ onClose }) {
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [trail, setTrail] = useState([]);
  const [attendanceMeta, setAttendanceMeta] = useState(null);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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

  const loadTimeline = useCallback(async () => {
    if (!employeeId || !date) return;

    setLoading(true);
    setSearched(true);
    setTrail([]);
    setAttendanceMeta(null);

    try {
      const attRes = await attendanceAPI.getAll({
        employeeId,
        startDate: date,
        endDate: date,
        limit: 1,
      });

      const record = attRes.data?.data?.records?.[0];

      if (!record) {
        toast.error("No attendance record for this employee on that date");
        return;
      }

      setAttendanceMeta(record);

      const attendanceId = record.id || record._id;

      const trailRes = await api.get(
        `/attendance/${attendanceId}/location-trail`,
      );

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
        }))
        .filter((point) => point.latitude !== null && point.longitude !== null)
        .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

      setTrail(normalized);
    } catch (error) {
      console.error(error);

      toast.error("Failed to load location timeline");
    } finally {
      setLoading(false);
    }
  }, [employeeId, date]);

  useEffect(() => {
    if (employeeId) {
      loadTimeline();
    }
  }, [employeeId, date, loadTimeline]);

  // Pings < 100 m apart collapse into a single stop (Google Timeline style)
  const stops = useMemo(() => clusterTrail(trail), [trail]);

  const stopByPoint = useMemo(() => {
    const map = new Map();
    stops.forEach((stop, index) => {
      stop.points.forEach((point) => map.set(point, { stop, index }));
    });
    return map;
  }, [stops]);

  // Newest first for the activity log; stops and the travel between them
  const activityFeed = useMemo(() => {
    const feed = [];

    stops.forEach((stop, index) => {
      if (index > 0) {
        feed.push({
          type: "travel",
          key: `travel-${index}`,
          travel: buildTravel(stops[index - 1], stop),
        });
      }

      feed.push({ type: "stop", key: `stop-${index}`, stop, index });
    });

    return feed.reverse();
  }, [stops]);

  const [googleFailed, setGoogleFailed] = useState(false);
  const useGoogleMap = Boolean(GOOGLE_MAPS_KEY) && !googleFailed;

  useEffect(() => {
    const onFailure = () => setGoogleFailed(true);
    window.addEventListener("etl-gmaps-failure", onFailure);
    return () => window.removeEventListener("etl-gmaps-failure", onFailure);
  }, []);

  useEffect(() => {
    console.info(
      `[EmployeeTimeline v2] map: ${useGoogleMap ? "google" : "leaflet"} | google key found: ${Boolean(GOOGLE_MAPS_KEY)}`,
    );
  }, [useGoogleMap]);

  const [placeNames, setPlaceNames] = useState({});

  // Look up place names, newest stop first (that's what is on top of the log)
  useEffect(() => {
    if (!stops.length) return undefined;

    let cancelled = false;

    (async () => {
      for (const stop of [...stops].reverse()) {
        if (cancelled) return;

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

        if (cancelled) return;

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
        return { title: resolved.title, subtitle: resolved.subtitle, loading: false };
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

      return { title: address || "Finding place name…", subtitle: "", loading: !address };
    },
    [placeNames],
  );

  const polylinePositions = useMemo(
    () => stops.map((stop) => [stop.latitude, stop.longitude]),
    [stops],
  );

  const eventPoints = useMemo(
    () =>
      trail.filter(
        (point) => point.source === "checkin" || point.source === "checkout",
      ),
    [trail],
  );

  const selectedEmployee = employees.find(
    (employee) => String(getEmployeeId(employee)) === String(employeeId),
  );

  const checkInPoint = trail.find((point) => point.source === "checkin");

  const checkOutPoint = [...trail]
    .reverse()
    .find((point) => point.source === "checkout");

  const status = getStatus(attendanceMeta);

  const isPresent = String(status).toLowerCase() === "present";

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

          font-family:
            'DM Sans',
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;

          animation: etlFadeIn .18s ease;
        }

        @keyframes etlFadeIn {
          from {
            opacity: 0;
            transform: scale(.99);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* HEADER */

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

        .etl-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

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

        .etl-header-icon svg {
          width: 21px;
          height: 21px;
        }

        .etl-title {
          font-size: 18px;
          font-weight: 750;
          letter-spacing: -.025em;
          color: #15171C;
        }

        .etl-subtitle {
          margin-top: 3px;

          font-size: 12px;
          color: #969BA5;
        }

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

          transition:
            background .15s ease,
            border-color .15s ease,
            color .15s ease;
        }

        .etl-close:hover {
          background: #FDEEEE;
          border-color: #F3D1D1;
          color: #C94B4B;
        }

        .etl-close svg {
          width: 19px;
          height: 19px;
        }

        /* FILTER BAR */

        .etl-toolbar {
          padding: 14px 28px;

          background: #FFFFFF;

          border-bottom: 1px solid #E7E9ED;

          display: flex;
          align-items: center;
          gap: 10px;

          flex-shrink: 0;
        }

        .etl-field {
          position: relative;
        }

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

          transition:
            border-color .15s ease,
            box-shadow .15s ease,
            background .15s ease;
        }

        .etl-select {
          width: 300px;
        }

        .etl-date {
          width: 175px;
        }

        .etl-select:focus,
        .etl-date:focus {
          background: #FFFFFF;
          border-color: #9CB5EF;

          box-shadow:
            0 0 0 3px #EDF3FF;
        }

        .etl-select option {
          color: #15171C;
          background: #FFFFFF;
        }

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

        .etl-chip-name {
          color: #15171C;
          font-weight: 650;
        }

        .etl-refresh {
          margin-left: auto;

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

        .etl-refresh:hover {
          background: #FAFBFC;
          color: #3567D6;
          border-color: #CBD7F1;
        }

        .etl-refresh svg {
          width: 17px;
          height: 17px;
        }

        /* CONTENT */

        .etl-content {
          flex: 1;
          min-height: 0;

          display: grid;

          grid-template-columns:
            minmax(0, 1fr)
            390px;

          overflow: hidden;
        }

        /* LEFT */

        .etl-left {
          min-width: 0;
          min-height: 0;

          padding: 18px;

          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* EMPLOYEE CONTEXT */

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

        .etl-context-left {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

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

        .etl-context-name {
          font-size: 13px;
          font-weight: 700;
          color: #15171C;
        }

        .etl-context-meta {
          margin-top: 3px;
          font-size: 11px;
          color: #969BA5;
        }

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

        .etl-date-badge svg {
          width: 14px;
          height: 14px;
        }

        /* MAP */

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
          width: 100%;
          height: 100%;
          min-height: 300px;

          background: #EEF1F5;
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

        .etl-map-empty-icon svg {
          width: 21px;
          height: 21px;
        }

        .etl-spinner {
          width: 27px;
          height: 27px;

          border-radius: 50%;

          border: 2px solid #E2E7EF;
          border-top-color: #3567D6;

          animation: etlSpin .7s linear infinite;
        }

        @keyframes etlSpin {
          to {
            transform: rotate(360deg);
          }
        }

        /* LEGEND */

        .etl-map-legend {
          position: absolute;

          z-index: 1000;

          top: 12px;
          left: 12px;

          display: flex;
          align-items: center;
          gap: 11px;

          padding: 8px 11px;

          background: rgba(255,255,255,.94);

          backdrop-filter: blur(8px);

          border: 1px solid #E2E5EA;

          border-radius: 8px;

          box-shadow:
            0 5px 16px rgba(20,30,50,.10);

          font-size: 10px;
        }

        .etl-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;

          color: #676C76;
          white-space: nowrap;
        }

        .etl-legend-dot {
          width: 7px;
          height: 7px;

          border-radius: 50%;
        }

        .etl-legend-line {
          width: 18px;
          height: 3px;

          border-radius: 3px;

          background: #3567D6;
        }

        .etl-expand-map {
          position: absolute;

          z-index: 1000;

          right: 12px;
          top: 12px;

          width: 34px;
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          background: rgba(255,255,255,.94);

          border: 1px solid #E2E5EA;

          border-radius: 8px;

          color: #676C76;

          box-shadow:
            0 5px 16px rgba(20,30,50,.10);

          cursor: pointer;
        }

        .etl-expand-map:hover {
          color: #3567D6;
        }

        .etl-expand-map svg {
          width: 16px;
          height: 16px;
        }

        /* RIGHT PANEL */

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

        .etl-section-title {
          font-size: 13px;
          font-weight: 750;

          color: #15171C;
        }

        .etl-section-subtitle {
          margin-top: 3px;

          font-size: 10px;
          color: #969BA5;
        }

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

        /* SUMMARY */

        .etl-summary {
          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 8px;

          margin-bottom: 18px;
        }

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

        .etl-stat-icon svg {
          width: 15px;
          height: 15px;
        }

        .etl-stat-label {
          font-size: 9px;

          text-transform: uppercase;

          letter-spacing: .06em;

          color: #969BA5;
        }

        .etl-stat-value {
          margin-top: 3px;

          color: #15171C;

          font-size: 13px;
          font-weight: 700;
        }

        /* ATTENDANCE STATUS */

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

        .etl-status-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .etl-status-dot {
          width: 8px;
          height: 8px;

          border-radius: 50%;

          background: #16845B;
        }

        .etl-status-label {
          font-size: 11px;
          color: #676C76;
        }

        .etl-status-value {
          font-size: 11px;
          font-weight: 750;

          color: #16845B;

          text-transform: capitalize;
        }

        /* TIMELINE */

        .etl-timeline {
          position: relative;

          padding-left: 8px;
        }

        .etl-timeline::before {
          content: '';

          position: absolute;

          left: 11px;
          top: 9px;
          bottom: 10px;

          width: 1px;

          background: #E7E9ED;
        }

        .etl-timeline-item {
          position: relative;

          display: flex;

          gap: 11px;

          padding-bottom: 16px;
        }

        .etl-timeline-item:last-child {
          padding-bottom: 0;
        }

        .etl-timeline-dot {
          position: relative;

          z-index: 2;

          width: 8px;
          height: 8px;

          margin-top: 5px;

          border-radius: 50%;

          border: 2px solid #FFFFFF;

          box-sizing: content-box;

          flex-shrink: 0;
        }

        .etl-timeline-dot.periodic {
          width: 5px;
          height: 5px;

          margin-left: 1.5px;
          margin-right: 1.5px;

          background: #CBD1DA !important;
        }

        .etl-timeline-body {
          flex: 1;
          min-width: 0;

          padding-bottom: 13px;

          border-bottom: 1px solid #F0F1F3;
        }

        .etl-timeline-item:last-child
        .etl-timeline-body {
          border-bottom: none;
        }

        .etl-timeline-top {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .etl-time {
          display: flex;
          align-items: center;
          gap: 4px;

          font-size: 12px;

          font-weight: 700;

          color: #15171C;
        }

        .etl-time svg {
          width: 12px;
          height: 12px;

          color: #969BA5;
        }

        .etl-badge {
          display: inline-flex;
          align-items: center;

          height: 21px;

          padding: 0 7px;

          border-radius: 5px;

          font-size: 9px;

          font-weight: 750;
        }

        .etl-location {
          display: flex;
          align-items: flex-start;
          gap: 5px;

          margin-top: 5px;

          font-size: 10px;

          line-height: 1.45;

          color: #969BA5;
        }

        .etl-location svg {
          width: 11px;
          height: 11px;

          flex-shrink: 0;

          margin-top: 1px;
        }

        .etl-accuracy {
          margin-top: 4px;

          font-size: 9px;
          color: #B0B5BE;
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

        /* LEAFLET POPUP */

        .leaflet-popup-content-wrapper {
          border-radius: 10px !important;

          box-shadow:
            0 8px 24px rgba(20,30,50,.15) !important;
        }

        .leaflet-popup-content {
          margin: 12px !important;
        }

        /* MOBILE */

        @media(max-width: 1050px) {
          .etl-content {
            grid-template-columns:
              minmax(0, 1fr)
              340px;
          }

          .etl-select {
            width: 250px;
          }
        }

        @media(max-width: 900px) {
          .etl-content {
            grid-template-columns: 1fr;

            grid-template-rows:
              minmax(440px, 58vh)
              auto;

            overflow-y: auto;
          }

          .etl-right {
            border-left: none;
            border-top: 1px solid #E7E9ED;

            overflow: visible;
          }

          .etl-map-card {
            min-height: 420px;
          }
        }

        @media(max-width: 650px) {
          .etl-header {
            min-height: 68px;
            padding: 0 14px;
          }

          .etl-header-icon {
            width: 36px;
            height: 36px;
          }

          .etl-title {
            font-size: 16px;
          }

          .etl-subtitle {
            font-size: 10px;
          }

          .etl-toolbar {
            padding: 10px 14px;

            flex-direction: column;
            align-items: stretch;
          }

          .etl-field,
          .etl-select,
          .etl-date {
            width: 100%;
          }

          .etl-employee-chip {
            margin-left: 0;
          }

          .etl-refresh {
            display: none;
          }

          .etl-left {
            padding: 10px;
          }

          .etl-context {
            padding: 11px;
          }

          .etl-date-badge {
            display: none;
          }

          .etl-map-card {
            min-height: 390px;
          }

          .etl-map-legend {
            gap: 7px;

            padding: 7px 8px;

            font-size: 9px;
          }

          .etl-right {
            padding: 16px;
          }
        }

        /* GOOGLE-TIMELINE STYLE ACTIVITY LOG */

        .etl-gt {
          display: flex;
          flex-direction: column;
        }

        .etl-gt-row {
          display: flex;
          gap: 12px;
          position: relative;
        }

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

        .etl-gt-row:first-child .etl-gt-rail::before {
          top: 15px;
        }

        .etl-gt-row:last-child .etl-gt-rail::before {
          bottom: calc(100% - 15px);
        }

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
        }

        .etl-gt-body {
          flex: 1;
          min-width: 0;
          padding-bottom: 18px;
        }

        .etl-gt-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          color: #15171C;
          word-break: break-word;
        }

        .etl-gt-title.loading {
          font-weight: 500;
          color: #969BA5;
          font-style: italic;
        }

        .etl-gt-sub {
          margin-top: 1px;
          font-size: 11px;
          line-height: 1.4;
          color: #7A808B;
          word-break: break-word;
        }

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

        .etl-gt-time svg {
          width: 12px;
          height: 12px;
          color: #969BA5;
        }

        .etl-gt-stay {
          margin-left: 4px;
          padding: 1px 7px;
          border-radius: 20px;
          background: #EDF3FF;
          color: #3567D6;
          font-size: 10px;
          font-weight: 700;
        }

        .etl-gt-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 7px;
        }

        .etl-gt-travel {
          align-items: center;
          min-height: 34px;
        }

        .etl-gt-travel .etl-gt-rail {
          justify-content: center;
        }

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

        .etl-gt-travel-icon svg {
          width: 10px;
          height: 10px;
          transform: rotate(90deg);
        }

        .etl-gt-travel-text {
          display: flex;
          flex-direction: column;
          font-size: 11px;
          font-weight: 600;
          color: #5B6270;
          padding: 4px 0;
        }

        .etl-gt-travel-text span {
          font-weight: 500;
          color: #969BA5;
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
              max={new Date().toISOString().slice(0, 10)}
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

          <button
            type="button"
            className="etl-refresh"
            onClick={loadTimeline}
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
              ) : trail.length === 0 ? (
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
                        style={{
                          background: SOURCE_COLOR.checkin,
                        }}
                      />
                      Check-in
                    </div>

                    <div className="etl-legend-item">
                      <span
                        className="etl-legend-dot"
                        style={{
                          background: SOURCE_COLOR.checkout,
                        }}
                      />
                      Check-out
                    </div>

                    <div className="etl-legend-item">
                      <span className="etl-legend-line" />
                      Movement
                    </div>
                  </div>

                  <button
                    type="button"
                    className="etl-expand-map"
                    title="Fit movement trail"
                    onClick={() => {}}
                  >
                    <ArrowsPointingOutIcon />
                  </button>

                  {useGoogleMap ? (
                    <GoogleTimelineMap
                      stops={stops}
                      eventPoints={eventPoints}
                      stopByPoint={stopByPoint}
                      getPlaceLabel={getPlaceLabel}
                      onFailure={() => setGoogleFailed(true)}
                    />
                  ) : (
                  <MapContainer
                    center={[trail[0].latitude, trail[0].longitude]}
                    zoom={15}
                    style={{
                      height: "100%",
                      width: "100%",
                    }}
                    scrollWheelZoom
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />

                    <FitToPoints points={stops} />

                    <Polyline
                      positions={polylinePositions}
                      pathOptions={{
                        color: "#3567D6",
                        weight: 4,
                        opacity: 0.8,
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                    />

                    <DirectionArrows points={stops} />

                    {eventPoints.map((point, index) => {
                      const type = point.source;

                      return (
                        <Marker
                          key={`${type}-${index}`}
                          position={[point.latitude, point.longitude]}
                          icon={eventIcon(SOURCE_COLOR[type], type)}
                        >
                          <Popup>
                            <div
                              style={{
                                fontFamily: "Arial, sans-serif",
                                fontSize: 12,
                                lineHeight: 1.6,
                                minWidth: 170,
                                color: "#15171C",
                              }}
                            >
                              <strong>{SOURCE_LABEL[type]}</strong>

                              <br />

                              {fmtTime(point.recorded_at)}

                              <br />

                              {(() => {
                                const owner = stopByPoint.get(point);
                                const label = owner
                                  ? getPlaceLabel(owner.stop)
                                  : null;

                                return (
                                  label?.title ||
                                  point.address ||
                                  `${point.latitude?.toFixed(
                                    5,
                                  )}, ${point.longitude?.toFixed(5)}`
                                );
                              })()}

                              {point.accuracy_meters && (
                                <>
                                  <br />
                                  Accuracy: ±{Math.round(point.accuracy_meters)}
                                  m
                                </>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}

                    {stops.map((stop, index) => {
                      if (isEventStop(stop)) return null;

                      const label = getPlaceLabel(stop);

                      return (
                        <Marker
                          key={`stop-${stop.key}-${index}`}
                          position={[stop.latitude, stop.longitude]}
                          icon={stopIcon(index + 1)}
                        >
                          <Popup>
                            <div
                              style={{
                                fontFamily: "Arial, sans-serif",
                                fontSize: 12,
                                lineHeight: 1.6,
                                minWidth: 170,
                                color: "#15171C",
                              }}
                            >
                              <strong>{label.title}</strong>

                              {label.subtitle && (
                                <>
                                  <br />
                                  {label.subtitle}
                                </>
                              )}

                              <br />

                              {fmtTime(stop.start)}
                              {stop.end !== stop.start &&
                                ` – ${fmtTime(stop.end)}`}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="etl-right">
            <div className="etl-right-header">
              <div>
                <div className="etl-section-title">Movement history</div>

                <div className="etl-section-subtitle">
                  Places visited today
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

            {trail.length > 0 && (
              <>
                <div className="etl-right-header">
                  <div>
                    <div className="etl-section-title">Activity log</div>

                    <div className="etl-section-subtitle">
                      Latest activity first · names from{" "}
                      {useGoogleMap ? "Google" : "OpenStreetMap"}
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
                    const dotColor = hasIn
                      ? SOURCE_COLOR.checkin
                      : hasOut
                        ? SOURCE_COLOR.checkout
                        : SOURCE_COLOR.periodic;

                    const sameTime = stop.start === stop.end;
                    const stayMinutes =
                      (new Date(stop.end) - new Date(stop.start)) / 60000;

                    return (
                      <div key={item.key} className="etl-gt-row">
                        <div className="etl-gt-rail">
                          <div
                            className="etl-gt-dot"
                            style={{ background: dotColor }}
                          >
                            {hasIn ? "IN" : hasOut ? "OUT" : index + 1}
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

                          {(hasIn || hasOut) && (
                            <div className="etl-gt-chips">
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

            {trail.length === 0 && attendanceMeta && (
              <div className="etl-empty-timeline">
                No movement locations were recorded for this attendance record.
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
                  <SignalIcon
                    style={{
                      width: 13,
                      height: 13,
                    }}
                  />
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
                    <div
                      style={{
                        fontSize: 9,
                        color: "#969BA5",
                      }}
                    >
                      Check-in
                    </div>

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
                      <CheckCircleIcon
                        style={{
                          width: 14,
                          height: 14,
                        }}
                      />

                      {fmtTime(checkInPoint.recorded_at)}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#969BA5",
                      }}
                    >
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
                        style={{
                          width: 14,
                          height: 14,
                        }}
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