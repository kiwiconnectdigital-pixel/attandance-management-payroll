import { useState, useEffect, useRef } from "react";
import { branchAPI, employeeAPI } from "../../services/api";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MapPinIcon,
  SignalIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  EnvelopeIcon,
  UsersIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";

import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* =========================================================
   Leaflet marker fix
========================================================= */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* =========================================================
   Map click handler
========================================================= */

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });

  return null;
};

/* =========================================================
   Default values
========================================================= */

const emptyForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
};

const emptyGeo = {
  enabled: false,
  latitude: "",
  longitude: "",
  radiusMeters: 100,
  address: "",
};

/* =========================================================
   Helpers
========================================================= */

const getBranchId = (branch) => branch?.id ?? branch?._id;

const getBranchActive = (branch) =>
  branch?.isActive ?? branch?.is_active ?? true;

const getGeofence = (branch) => {
  const geo = branch?.geofence || {};

  return {
    enabled: geo.enabled ?? branch?.geofence_enabled ?? false,
    latitude: geo.latitude ?? branch?.latitude ?? "",
    longitude: geo.longitude ?? branch?.longitude ?? "",
    radiusMeters:
      geo.radiusMeters ??
      geo.radius_meters ??
      branch?.geofence_radius_meters ??
      100,
    address:
      geo.address ??
      branch?.geofence_address ??
      "",
  };
};

/* =========================================================
   Component
========================================================= */

const BranchPage = () => {
  const [branches, setBranches] = useState([]);
  const [branchStats, setBranchStats] = useState({});

  /* Add/Edit modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  /* Geofence modal */
  const [geoModal, setGeoModal] = useState(false);
  const [geoTarget, setGeoTarget] = useState(null);
  const [geoForm, setGeoForm] = useState(emptyGeo);
  const [locationQuery, setLocationQuery] = useState("");
  const [geoSearchLoading, setGeoSearchLoading] = useState(false);

  const mapRef = useRef(null);

  /* =========================================================
     Fetch branches
  ========================================================= */

  const fetchBranches = async () => {
    try {
      const res = await branchAPI.getAll();

      const rawBranches =
        res.data?.data?.branches ||
        res.data?.data ||
        [];

      const branchList = Array.isArray(rawBranches)
        ? rawBranches
        : [];

      setBranches(branchList);

      const stats = {};

      await Promise.all(
        branchList.map(async (branch) => {
          const branchId = getBranchId(branch);

          if (!branchId) return;

          try {
            const emp = await employeeAPI.getAll({
              branch: branchId,
              limit: 1,
            });

            const pagination =
              emp.data?.data?.pagination ||
              emp.data?.pagination;

            const employees =
              emp.data?.data?.employees ||
              emp.data?.data ||
              [];

            stats[branchId] =
              Number(pagination?.total) ||
              (Array.isArray(employees)
                ? employees.length
                : 0);
          } catch {
            stats[branchId] = 0;
          }
        }),
      );

      setBranchStats(stats);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load branches");
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  /* =========================================================
     Add branch
  ========================================================= */

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setModalOpen(true);
  };

  /* =========================================================
     Edit branch
  ========================================================= */

  const openEdit = (branch) => {
    setForm({
      name: branch?.name || "",
      code: branch?.code || "",
      address: branch?.address || "",
      city: branch?.city || "",
      state: branch?.state || "",
      pincode: branch?.pincode || "",
      phone: branch?.phone || "",
      email: branch?.email || "",
    });

    setEditingId(getBranchId(branch));
    setModalOpen(true);
  };

  /* =========================================================
     Close add/edit modal
  ========================================================= */

  const closeBranchModal = () => {
    if (loading) return;

    setModalOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  /* =========================================================
     Submit branch
  ========================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Branch name is required");
      return;
    }

    if (!form.code.trim()) {
      toast.error("Branch code is required");
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        await branchAPI.update(editingId, form);
        toast.success("Branch updated successfully");
      } else {
        await branchAPI.create(form);
        toast.success("Branch created successfully");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });

      await fetchBranches();
    } catch (error) {
      console.error(error);

      toast.error(
        error?.response?.data?.message ||
          "Failed to save branch",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     Delete / deactivate
  ========================================================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Deactivate this branch?")) {
      return;
    }

    try {
      await branchAPI.delete(id);

      toast.success("Branch deactivated");

      await fetchBranches();
    } catch (error) {
      console.error(error);
      toast.error("Failed to deactivate branch");
    }
  };

  /* =========================================================
     Open geofence modal
  ========================================================= */

  const openGeoModal = (branch) => {
    const geo = getGeofence(branch);

    setGeoTarget(branch);

    setGeoForm({
      enabled: Boolean(geo.enabled),
      latitude: geo.latitude ?? "",
      longitude: geo.longitude ?? "",
      radiusMeters: geo.radiusMeters ?? 100,
      address: geo.address ?? "",
    });

    setLocationQuery(
      geo.address ||
        [
          branch?.address,
          branch?.city,
          branch?.state,
        ]
          .filter(Boolean)
          .join(", "),
    );

    setGeoModal(true);
  };

  /* =========================================================
     Map click
  ========================================================= */

  const handleMapClick = ({ lat, lng }) => {
    setGeoForm((current) => ({
      ...current,
      latitude: Number(lat.toFixed(7)),
      longitude: Number(lng.toFixed(7)),
    }));
  };

  /* =========================================================
     Current location
  ========================================================= */

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error(
        "Geolocation is not supported by this browser",
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setGeoForm((current) => ({
          ...current,
          latitude: Number(latitude.toFixed(7)),
          longitude: Number(longitude.toFixed(7)),
        }));

        if (mapRef.current) {
          mapRef.current.setView(
            [latitude, longitude],
            17,
          );
        }

        toast.success("Current location captured");
      },
      (error) => {
        console.error(error);
        toast.error("Location access denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  /* =========================================================
     Search location using Nominatim
  ========================================================= */

  const autoSelectLocationFromText = async () => {
    const query = locationQuery.trim();

    if (!query) {
      toast.error("Enter a location to search");
      return;
    }

    setGeoSearchLoading(true);

    try {
      const cleanQuery = query
        .replace(/\b\d{6}\b/g, "")
        .replace(/\bnear\b.*$/i, "")
        .replace(/[|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const queries = [
        cleanQuery,
        `${cleanQuery}, India`,
      ];

      let selected = null;

      for (const searchQuery of queries) {
        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?format=json` +
          `&addressdetails=1` +
          `&limit=5` +
          `&countrycodes=in` +
          `&q=${encodeURIComponent(searchQuery)}`;

        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent":
              "AttendanceManagementSystem/1.0",
          },
        });

        if (!response.ok) {
          continue;
        }

        const results = await response.json();

        if (Array.isArray(results) && results.length) {
          selected = results[0];
          break;
        }
      }

      if (!selected) {
        toast.error("Location not found");
        return;
      }

      const latitude = Number(selected.lat);
      const longitude = Number(selected.lon);

      setGeoForm((current) => ({
        ...current,
        latitude,
        longitude,
        address:
          selected.display_name ||
          current.address,
      }));

      if (mapRef.current) {
        mapRef.current.setView(
          [latitude, longitude],
          17,
        );
      }

      toast.success("Location selected");
    } catch (error) {
      console.error(error);
      toast.error("Unable to search location");
    } finally {
      setGeoSearchLoading(false);
    }
  };

  /* =========================================================
     Save geofence
  ========================================================= */

  const handleGeoSave = async () => {
    if (!geoTarget) return;

    if (
      geoForm.enabled &&
      (!geoForm.latitude ||
        !geoForm.longitude)
    ) {
      toast.error(
        "Select a location before enabling geofence",
      );
      return;
    }

    try {
      await branchAPI.updateGeofence(
        getBranchId(geoTarget),
        {
          ...geoForm,
          locationQuery,
        },
      );

      toast.success("Geofence saved successfully");

      setGeoModal(false);
      setGeoTarget(null);

      await fetchBranches();
    } catch (error) {
      console.error(error);

      toast.error(
        error?.response?.data?.message ||
          "Failed to save geofence",
      );
    }
  };

  /* =========================================================
     Statistics
  ========================================================= */

  const totalEmployees = Object.values(
    branchStats,
  ).reduce(
    (total, count) => total + Number(count || 0),
    0,
  );

  const activeCount = branches.filter(
    (branch) => getBranchActive(branch),
  ).length;

  const geoCount = branches.filter(
    (branch) => getGeofence(branch).enabled,
  ).length;

  const mapCenter =
    geoForm.latitude &&
    geoForm.longitude
      ? [
          parseFloat(geoForm.latitude),
          parseFloat(geoForm.longitude),
        ]
      : [20.5937, 78.9629];

  /* =========================================================
     Render
  ========================================================= */

  return (
    <div className="branch-page">
      <div className="branch-shell">

        {/* =================================================
            Header
        ================================================= */}

        <header className="branch-page-header">
          <div>
            <div className="branch-eyebrow">
              Workforce management
            </div>

            <h1>Branches</h1>

            <p>
              Manage office locations, workforce
              assignments and attendance geofencing.
            </p>
          </div>

          <button
            className="branch-primary-button"
            onClick={openCreate}
          >
            <PlusIcon />
            Add branch
          </button>
        </header>

        {/* =================================================
            KPI cards
        ================================================= */}

        <section className="branch-kpis">

          <div className="branch-kpi-card">
            <div className="branch-kpi-icon blue">
              <BuildingOffice2Icon />
            </div>

            <div>
              <span>Total branches</span>
              <strong>{branches.length}</strong>
            </div>
          </div>

          <div className="branch-kpi-card">
            <div className="branch-kpi-icon green">
              <CheckCircleIcon />
            </div>

            <div>
              <span>Active branches</span>
              <strong>{activeCount}</strong>
            </div>
          </div>

          <div className="branch-kpi-card">
            <div className="branch-kpi-icon purple">
              <UsersIcon />
            </div>

            <div>
              <span>Total employees</span>
              <strong>{totalEmployees}</strong>
            </div>
          </div>

          <div className="branch-kpi-card">
            <div className="branch-kpi-icon orange">
              <SignalIcon />
            </div>

            <div>
              <span>Geofenced</span>
              <strong>{geoCount}</strong>
            </div>
          </div>

        </section>

        {/* =================================================
            Branch section
        ================================================= */}

        <section className="branch-content">

          <div className="branch-section-heading">
            <div>
              <h2>Office locations</h2>
              <p>
                Your organization's registered
                branches and attendance locations.
              </p>
            </div>

            <button
              className="branch-refresh-button"
              onClick={fetchBranches}
              title="Refresh branches"
            >
              <ArrowPathIcon />
              Refresh
            </button>
          </div>

          {/* =================================================
              Empty state
          ================================================= */}

          {!branches.length ? (
            <div className="branch-empty-state">

              <div className="branch-empty-icon">
                <BuildingOffice2Icon />
              </div>

              <h3>No branches yet</h3>

              <p>
                Add your first office location to start
                managing branch employees and attendance.
              </p>

              <button
                className="branch-primary-button"
                onClick={openCreate}
              >
                <PlusIcon />
                Add branch
              </button>

            </div>
          ) : (
            <div className="branch-grid">

              {branches.map((branch) => {
                const branchId =
                  getBranchId(branch);

                const isActive =
                  getBranchActive(branch);

                const geo =
                  getGeofence(branch);

                const employeeCount =
                  branchStats[branchId] || 0;

                return (
                  <article
                    className="branch-card"
                    key={branchId}
                  >

                    {/* Card header */}

                    <div className="branch-card-top">

                      <div className="branch-identity">

                        <div className="branch-avatar">
                          <BuildingOffice2Icon />
                        </div>

                        <div className="branch-title">
                          <h3>
                            {branch.name ||
                              "Unnamed branch"}
                          </h3>

                          <span>
                            {branch.code ||
                              "No branch code"}
                          </span>
                        </div>

                      </div>

                      <span
                        className={`branch-status ${
                          isActive
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        <span className="status-dot" />
                        {isActive
                          ? "Active"
                          : "Inactive"}
                      </span>

                    </div>

                    {/* Branch information */}

                    <div className="branch-details">

                      <div className="branch-detail-row">
                        <MapPinIcon />

                        <span>
                          {[
                            branch.address,
                            branch.city,
                            branch.state,
                            branch.pincode,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                            "Address not available"}
                        </span>
                      </div>

                      {branch.phone && (
                        <div className="branch-detail-row">
                          <PhoneIcon />
                          <span>
                            {branch.phone}
                          </span>
                        </div>
                      )}

                      {branch.email && (
                        <div className="branch-detail-row">
                          <EnvelopeIcon />
                          <span>
                            {branch.email}
                          </span>
                        </div>
                      )}

                    </div>

                    {/* Geofence */}

                    <div
                      className={`branch-geofence ${
                        geo.enabled
                          ? "enabled"
                          : "disabled"
                      }`}
                    >
                      <div className="branch-geofence-left">

                        <div className="branch-geofence-icon">
                          <SignalIcon />
                        </div>

                        <div>
                          <strong>
                            Attendance geofence
                          </strong>

                          <span>
                            {geo.enabled
                              ? `${geo.radiusMeters}m radius`
                              : "Not configured"}
                          </span>
                        </div>

                      </div>

                      <span>
                        {geo.enabled
                          ? "Enabled"
                          : "Off"}
                      </span>
                    </div>

                    {/* Footer */}

                    <div className="branch-card-footer">

                      <div className="branch-employee-count">
                        <UsersIcon />

                        <div>
                          <strong>
                            {employeeCount}
                          </strong>

                          <span>
                            Employees
                          </span>
                        </div>
                      </div>

                      <div className="branch-actions">

                        <button
                          className="branch-action-button geo"
                          onClick={() =>
                            openGeoModal(branch)
                          }
                          title="Manage geofence"
                        >
                          <MapPinIcon />
                        </button>

                        <button
                          className="branch-action-button"
                          onClick={() =>
                            openEdit(branch)
                          }
                          title="Edit branch"
                        >
                          <PencilIcon />
                        </button>

                        <button
                          className="branch-action-button danger"
                          onClick={() =>
                            handleDelete(branchId)
                          }
                          title="Deactivate branch"
                        >
                          <TrashIcon />
                        </button>

                      </div>

                    </div>

                  </article>
                );
              })}

            </div>
          )}

        </section>
      </div>

      {/* =====================================================
          ADD / EDIT BRANCH POPUP
      ===================================================== */}

      <Modal
        isOpen={modalOpen}
        onClose={closeBranchModal}
        title={
          editingId
            ? "Edit branch"
            : "Add branch"
        }
      >
        <form
          onSubmit={handleSubmit}
          className="branch-form"
        >

          <div className="branch-form-header">

            <div>
              <h3>
                {editingId
                  ? "Update branch details"
                  : "Create a new branch"}
              </h3>

              <p>
                {editingId
                  ? "Update the office location and contact information."
                  : "Add an office location to your organization."}
              </p>
            </div>

          </div>

          {/* Branch details */}

          <div className="form-section">

            <div className="form-section-title">

              <BuildingOffice2Icon />

              <div>
                <strong>
                  Branch information
                </strong>

                <span>
                  Basic office and location details
                </span>
              </div>

            </div>

            <div className="form-grid">

              <div className="form-field">
                <label>
                  Branch name *
                </label>

                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Head Office"
                  required
                />
              </div>

              <div className="form-field">
                <label>
                  Branch code *
                </label>

                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      code: e.target.value,
                    })
                  }
                  placeholder="e.g. BPL-001"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label>
                  Address *
                </label>

                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: e.target.value,
                    })
                  }
                  placeholder="Office address"
                  required
                />
              </div>

              <div className="form-field">
                <label>
                  City *
                </label>

                <input
                  type="text"
                  value={form.city}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      city: e.target.value,
                    })
                  }
                  placeholder="City"
                  required
                />
              </div>

              <div className="form-field">
                <label>
                  State *
                </label>

                <input
                  type="text"
                  value={form.state}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      state: e.target.value,
                    })
                  }
                  placeholder="State"
                  required
                />
              </div>

              <div className="form-field">
                <label>
                  Pincode
                </label>

                <input
                  type="text"
                  value={form.pincode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pincode: e.target.value,
                    })
                  }
                  placeholder="Pincode"
                />
              </div>

            </div>

          </div>

          {/* Contact */}

          <div className="form-section">

            <div className="form-section-title">

              <PhoneIcon />

              <div>
                <strong>
                  Contact information
                </strong>

                <span>
                  Branch contact details
                </span>
              </div>

            </div>

            <div className="form-grid">

              <div className="form-field">
                <label>
                  Phone
                </label>

                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value,
                    })
                  }
                  placeholder="Phone number"
                />
              </div>

              <div className="form-field">
                <label>
                  Email
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                  placeholder="branch@company.com"
                />
              </div>

            </div>

          </div>

          {/* Footer */}

          <div className="branch-form-footer">

            <button
              type="button"
              className="btn-secondary"
              onClick={closeBranchModal}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : editingId
                  ? "Update branch"
                  : "Create branch"}
            </button>

          </div>

        </form>
      </Modal>

      {/* =====================================================
          GEOFENCE POPUP
      ===================================================== */}

      <Modal
        isOpen={geoModal}
        onClose={() => {
          setGeoModal(false);
          setGeoTarget(null);
        }}
        title="Attendance geofence"
      >
        <div className="geo-form">

          {/* Context */}

          {geoTarget && (
            <div className="geo-branch-context">

              <div className="geo-context-icon">
                <BuildingOffice2Icon />
              </div>

              <div>
                <strong>
                  {geoTarget.name}
                </strong>

                <span>
                  {geoTarget.code}
                </span>
              </div>

            </div>
          )}

          {/* Enable toggle */}

          <div className="geo-enable-card">

            <div className="geo-enable-copy">

              <div className="geo-enable-icon">
                <SignalIcon />
              </div>

              <div>
                <strong>
                  Enable attendance geofence
                </strong>

                <span>
                  Restrict attendance punches to
                  the selected office area.
                </span>
              </div>

            </div>

            <button
              type="button"
              className={`geo-toggle ${
                geoForm.enabled
                  ? "on"
                  : ""
              }`}
              onClick={() =>
                setGeoForm((current) => ({
                  ...current,
                  enabled: !current.enabled,
                }))
              }
              aria-label="Toggle geofence"
            >
              <span />
            </button>

          </div>

          {/* Location search */}

          <div className="geo-section">

            <div className="geo-section-heading">
              <div>
                <h3>
                  Office location
                </h3>

                <p>
                  Search for an address or select
                  the location directly on the map.
                </p>
              </div>
            </div>

            <div className="location-search">

              <div className="location-search-input">
                <MagnifyingGlassIcon />

                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) =>
                    setLocationQuery(
                      e.target.value,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      autoSelectLocationFromText();
                    }
                  }}
                  placeholder="Search office address..."
                />
              </div>

              <button
                type="button"
                className="location-search-button"
                onClick={
                  autoSelectLocationFromText
                }
                disabled={geoSearchLoading}
              >
                {geoSearchLoading
                  ? "Searching..."
                  : "Search"}
              </button>

            </div>

            <button
              type="button"
              className="use-location-button"
              onClick={useMyLocation}
            >
              <MapPinIcon />
              Use my current location
            </button>

          </div>

          {/* Map */}

          <div className="geo-map-wrapper">

            <MapContainer
              center={mapCenter}
              zoom={
                geoForm.latitude &&
                geoForm.longitude
                  ? 17
                  : 5
              }
              scrollWheelZoom={true}
              style={{
                height: "280px",
                width: "100%",
              }}
              ref={mapRef}
            >

              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler
                onMapClick={handleMapClick}
              />

              {geoForm.latitude &&
                geoForm.longitude && (
                  <>
                    <Marker
                      position={[
                        parseFloat(
                          geoForm.latitude,
                        ),
                        parseFloat(
                          geoForm.longitude,
                        ),
                      ]}
                    />

                    <Circle
                      center={[
                        parseFloat(
                          geoForm.latitude,
                        ),
                        parseFloat(
                          geoForm.longitude,
                        ),
                      ]}
                      radius={Number(
                        geoForm.radiusMeters ||
                          100,
                      )}
                      pathOptions={{
                        color: "#3567D6",
                        fillColor: "#3567D6",
                        fillOpacity: 0.12,
                        weight: 2,
                      }}
                    />
                  </>
                )}

            </MapContainer>

            <div className="map-help">
              Click anywhere on the map to set
              the attendance location.
            </div>

          </div>

          {/* Coordinates */}

          <div className="geo-section">

            <div className="geo-section-heading">
              <div>
                <h3>
                  Coordinates
                </h3>

                <p>
                  Fine-tune the exact attendance
                  location if required.
                </p>
              </div>
            </div>

            <div className="form-grid">

              <div className="form-field">
                <label>
                  Latitude
                </label>

                <input
                  type="number"
                  step="any"
                  value={
                    geoForm.latitude
                  }
                  onChange={(e) =>
                    setGeoForm({
                      ...geoForm,
                      latitude:
                        e.target.value,
                    })
                  }
                  placeholder="20.5937"
                />
              </div>

              <div className="form-field">
                <label>
                  Longitude
                </label>

                <input
                  type="number"
                  step="any"
                  value={
                    geoForm.longitude
                  }
                  onChange={(e) =>
                    setGeoForm({
                      ...geoForm,
                      longitude:
                        e.target.value,
                    })
                  }
                  placeholder="78.9629"
                />
              </div>

            </div>

          </div>

          {/* Radius */}

          <div className="geo-radius-card">

            <div className="radius-header">

              <div>
                <strong>
                  Attendance radius
                </strong>

                <span>
                  Employees must be within this
                  distance to punch attendance.
                </span>
              </div>

              <div className="radius-value">
                {geoForm.radiusMeters}m
              </div>

            </div>

            <input
              type="range"
              min="25"
              max="1000"
              step="25"
              value={
                Number(
                  geoForm.radiusMeters,
                ) || 100
              }
              onChange={(e) =>
                setGeoForm({
                  ...geoForm,
                  radiusMeters:
                    Number(
                      e.target.value,
                    ),
                })
              }
              className="radius-slider"
            />

            <div className="radius-scale">
              <span>25m</span>
              <span>500m</span>
              <span>1000m</span>
            </div>

          </div>

          {/* Address */}

          <div className="form-field">
            <label>
              Location label
            </label>

            <input
              type="text"
              value={geoForm.address}
              onChange={(e) =>
                setGeoForm({
                  ...geoForm,
                  address: e.target.value,
                })
              }
              placeholder="e.g. Head Office, MP Nagar"
            />
          </div>

          {/* Preview */}

          <div className="geo-preview">

            <div className="geo-preview-icon">
              <MapPinIcon />
            </div>

            <div>
              <strong>
                Geofence preview
              </strong>

              <span>
                {geoForm.enabled
                  ? `Attendance is allowed within ${geoForm.radiusMeters} metres of the selected location.`
                  : "Geofence is currently disabled for this branch."}
              </span>
            </div>

          </div>

          {/* Footer */}

          <div className="geo-form-footer">

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setGeoModal(false);
                setGeoTarget(null);
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleGeoSave}
            >
              Save geofence
            </button>

          </div>

        </div>
      </Modal>

      {/* =====================================================
          PAGE STYLES
      ===================================================== */}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .branch-page {
          min-height: 100vh;
          background: #F6F7F9;
          color: #15171C;
          padding: 30px;
        }

        .branch-shell {
          width: 100%;
          max-width: 1380px;
          margin: 0 auto;
        }

        /* =========================
           Header
        ========================= */

        .branch-page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .branch-eyebrow {
          margin-bottom: 8px;
          color: #3567D6;
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .branch-page-header h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.15;
          letter-spacing: -0.035em;
          font-weight: 750;
        }

        .branch-page-header p {
          margin: 8px 0 0;
          color: #676C76;
          font-size: 14px;
        }

        .branch-primary-button {
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border: 1px solid #3567D6;
          border-radius: 9px;
          background: #3567D6;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(53, 103, 214, 0.16);
          transition: all 0.15s ease;
        }

        .branch-primary-button:hover {
          background: #2F5FC9;
          transform: translateY(-1px);
        }

        .branch-primary-button svg {
          width: 17px;
          height: 17px;
        }

        /* =========================
           KPI
        ========================= */

        .branch-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 28px;
        }

        .branch-kpi-card {
          min-height: 104px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px;
          border: 1px solid #E7E9ED;
          border-radius: 13px;
          background: #FFFFFF;
          box-shadow: 0 2px 8px rgba(20, 24, 32, 0.025);
        }

        .branch-kpi-icon {
          width: 43px;
          height: 43px;
          flex: 0 0 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
        }

        .branch-kpi-icon svg {
          width: 21px;
          height: 21px;
        }

        .branch-kpi-icon.blue {
          background: #EDF3FF;
          color: #3567D6;
        }

        .branch-kpi-icon.green {
          background: #EAF7F1;
          color: #16845B;
        }

        .branch-kpi-icon.purple {
          background: #F1EDFF;
          color: #7357C8;
        }

        .branch-kpi-icon.orange {
          background: #FFF4E5;
          color: #C97816;
        }

        .branch-kpi-card span {
          display: block;
          margin-bottom: 4px;
          color: #777C86;
          font-size: 12px;
          font-weight: 550;
        }

        .branch-kpi-card strong {
          display: block;
          color: #15171C;
          font-size: 24px;
          line-height: 1;
          letter-spacing: -0.025em;
        }

        /* =========================
           Content
        ========================= */

        .branch-content {
          padding: 24px;
          border: 1px solid #E7E9ED;
          border-radius: 15px;
          background: #FFFFFF;
          box-shadow: 0 3px 12px rgba(20, 24, 32, 0.025);
        }

        .branch-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .branch-section-heading h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 720;
          letter-spacing: -0.02em;
        }

        .branch-section-heading p {
          margin: 5px 0 0;
          color: #818691;
          font-size: 12px;
        }

        .branch-refresh-button {
          height: 36px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid #E2E5EA;
          border-radius: 8px;
          background: #FFFFFF;
          color: #555B65;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .branch-refresh-button:hover {
          background: #FAFBFC;
          border-color: #D3D7DE;
        }

        .branch-refresh-button svg {
          width: 15px;
          height: 15px;
        }

        /* =========================
           Branch Grid
        ========================= */

        .branch-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .branch-card {
          min-width: 0;
          padding: 18px;
          border: 1px solid #E7E9ED;
          border-radius: 13px;
          background: #FFFFFF;
          transition:
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            transform 0.18s ease;
        }

        .branch-card:hover {
          border-color: #D8DCE3;
          box-shadow: 0 8px 24px rgba(20, 24, 32, 0.06);
          transform: translateY(-1px);
        }

        .branch-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 17px;
          border-bottom: 1px solid #EEF0F3;
        }

        .branch-identity {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .branch-avatar {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #EDF3FF;
          color: #3567D6;
        }

        .branch-avatar svg {
          width: 20px;
          height: 20px;
        }

        .branch-title {
          min-width: 0;
        }

        .branch-title h3 {
          margin: 0;
          overflow: hidden;
          color: #15171C;
          font-size: 14px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .branch-title span {
          display: inline-block;
          margin-top: 4px;
          color: #888D96;
          font-size: 11px;
          font-weight: 600;
        }

        .branch-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
        }

        .branch-status.active {
          background: #EAF7F1;
          color: #16845B;
        }

        .branch-status.inactive {
          background: #FDEEEE;
          color: #C94B4B;
        }

        .status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        /* =========================
           Details
        ========================= */

        .branch-details {
          padding: 17px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 115px;
        }

        .branch-detail-row {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          color: #676C76;
          font-size: 12px;
          line-height: 1.5;
        }

        .branch-detail-row svg {
          width: 16px;
          height: 16px;
          flex: 0 0 16px;
          margin-top: 1px;
          color: #969BA5;
        }

        .branch-detail-row span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        /* =========================
           Geofence
        ========================= */

        .branch-geofence {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 11px;
          border-radius: 10px;
        }

        .branch-geofence.enabled {
          background: #F5F9FF;
          border: 1px solid #E1EAFE;
        }

        .branch-geofence.disabled {
          background: #FAFBFC;
          border: 1px solid #EEF0F3;
        }

        .branch-geofence-left {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .branch-geofence-icon {
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #FFFFFF;
          color: #3567D6;
          box-shadow: 0 1px 3px rgba(20, 24, 32, 0.04);
        }

        .branch-geofence-icon svg {
          width: 15px;
          height: 15px;
        }

        .branch-geofence strong {
          display: block;
          color: #41464F;
          font-size: 11px;
          font-weight: 700;
        }

        .branch-geofence span {
          color: #8A8F98;
          font-size: 10px;
        }

        .branch-geofence > span {
          color: #3567D6;
          font-weight: 700;
        }

        .branch-geofence.disabled > span {
          color: #969BA5;
        }

        /* =========================
           Card Footer
        ========================= */

        .branch-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 16px;
          margin-top: 14px;
          border-top: 1px solid #EEF0F3;
        }

        .branch-employee-count {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .branch-employee-count > svg {
          width: 17px;
          height: 17px;
          color: #7357C8;
        }

        .branch-employee-count strong {
          display: inline;
          color: #30343B;
          font-size: 12px;
          margin-right: 4px;
        }

        .branch-employee-count span {
          color: #969BA5;
          font-size: 10px;
        }

        .branch-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .branch-action-button {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #E4E7EB;
          border-radius: 8px;
          background: #FFFFFF;
          color: #666B74;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .branch-action-button:hover {
          background: #F6F7F9;
          color: #3567D6;
          border-color: #D7DBE2;
        }

        .branch-action-button.geo {
          color: #3567D6;
          background: #F5F8FF;
          border-color: #E0E8FA;
        }

        .branch-action-button.danger:hover {
          color: #C94B4B;
          background: #FDEEEE;
          border-color: #F3D1D1;
        }

        .branch-action-button svg {
          width: 15px;
          height: 15px;
        }

        /* =========================
           Empty
        ========================= */

        .branch-empty-state {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 20px;
          border: 1px dashed #DDE1E7;
          border-radius: 12px;
          background: #FAFBFC;
        }

        .branch-empty-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          border-radius: 15px;
          background: #EDF3FF;
          color: #3567D6;
        }

        .branch-empty-icon svg {
          width: 26px;
          height: 26px;
        }

        .branch-empty-state h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }

        .branch-empty-state p {
          max-width: 400px;
          margin: 7px 0 20px;
          color: #7B808A;
          font-size: 12px;
          line-height: 1.6;
        }

        /* =========================
           Add/Edit Form
        ========================= */

        .branch-form {
          width: min(760px, 100%);
          color: #15171C;
        }

        .branch-form-header {
          padding: 4px 0 20px;
          border-bottom: 1px solid #E7E9ED;
        }

        .branch-form-header h3 {
          margin: 0;
          font-size: 19px;
          font-weight: 720;
          letter-spacing: -0.02em;
        }

        .branch-form-header p {
          margin: 6px 0 0;
          color: #676C76;
          font-size: 12px;
        }

        .form-section {
          padding: 20px 0;
          border-bottom: 1px solid #E7E9ED;
        }

        .form-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 17px;
        }

        .form-section-title > svg {
          width: 18px;
          height: 18px;
          color: #3567D6;
        }

        .form-section-title strong {
          display: block;
          font-size: 13px;
          font-weight: 700;
        }

        .form-section-title span {
          display: block;
          margin-top: 3px;
          color: #969BA5;
          font-size: 11px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-field-full {
          grid-column: 1 / -1;
        }

        .form-field label {
          color: #454A54;
          font-size: 11px;
          font-weight: 650;
        }

        .form-field input {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #DFE2E7;
          border-radius: 8px;
          outline: none;
          background: #FFFFFF;
          color: #15171C;
          font-size: 12px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .form-field input::placeholder {
          color: #A4A8B0;
        }

        .form-field input:hover {
          border-color: #CFD3DA;
        }

        .form-field input:focus {
          border-color: #3567D6;
          box-shadow: 0 0 0 3px rgba(53, 103, 214, 0.1);
        }

        .branch-form-footer,
        .geo-form-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding-top: 19px;
        }

        .btn-primary,
        .btn-secondary {
          height: 40px;
          padding: 0 17px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          border: 1px solid #3567D6;
          background: #3567D6;
          color: #FFFFFF;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2F5FC9;
        }

        .btn-secondary {
          border: 1px solid #DFE2E7;
          background: #FFFFFF;
          color: #454A54;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #F6F7F9;
          border-color: #CFD3DA;
        }

        .btn-primary:disabled,
        .btn-secondary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* =========================
           Geofence
        ========================= */

        .geo-form {
          width: min(780px, 100%);
        }

        .geo-branch-context {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px;
          margin-bottom: 15px;
          border: 1px solid #E4E9F3;
          border-radius: 10px;
          background: #F7F9FD;
        }

        .geo-context-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #EDF3FF;
          color: #3567D6;
        }

        .geo-context-icon svg {
          width: 19px;
          height: 19px;
        }

        .geo-branch-context strong {
          display: block;
          font-size: 13px;
        }

        .geo-branch-context span {
          display: block;
          margin-top: 3px;
          color: #888D96;
          font-size: 10px;
        }

        .geo-enable-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 14px;
          border: 1px solid #E5E8ED;
          border-radius: 10px;
          background: #FFFFFF;
        }

        .geo-enable-copy {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .geo-enable-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #EDF3FF;
          color: #3567D6;
        }

        .geo-enable-icon svg {
          width: 17px;
          height: 17px;
        }

        .geo-enable-copy strong {
          display: block;
          color: #30343B;
          font-size: 12px;
        }

        .geo-enable-copy span {
          display: block;
          margin-top: 3px;
          color: #8A8F98;
          font-size: 10px;
        }

        .geo-toggle {
          width: 42px;
          height: 24px;
          flex: 0 0 42px;
          position: relative;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: #D9DDE3;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .geo-toggle span {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
          transition: transform 0.2s ease;
        }

        .geo-toggle.on {
          background: #3567D6;
        }

        .geo-toggle.on span {
          transform: translateX(18px);
        }

        .geo-section {
          padding: 19px 0;
          border-bottom: 1px solid #E7E9ED;
        }

        .geo-section-heading {
          margin-bottom: 13px;
        }

        .geo-section-heading h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
        }

        .geo-section-heading p {
          margin: 4px 0 0;
          color: #8A8F98;
          font-size: 10px;
        }

        .location-search {
          display: flex;
          gap: 8px;
        }

        .location-search-input {
          height: 42px;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border: 1px solid #DFE2E7;
          border-radius: 8px;
          background: #FFFFFF;
        }

        .location-search-input:focus-within {
          border-color: #3567D6;
          box-shadow: 0 0 0 3px rgba(53, 103, 214, 0.1);
        }

        .location-search-input svg {
          width: 16px;
          height: 16px;
          flex: 0 0 16px;
          color: #969BA5;
        }

        .location-search-input input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #15171C;
          font-size: 12px;
        }

        .location-search-button {
          height: 42px;
          padding: 0 14px;
          border: 1px solid #DDE3F1;
          border-radius: 8px;
          background: #EDF3FF;
          color: #3567D6;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .location-search-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .use-location-button {
          height: 34px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 9px;
          padding: 0 10px;
          border: 0;
          border-radius: 7px;
          background: #F5F7FA;
          color: #555B65;
          font-size: 10px;
          font-weight: 650;
          cursor: pointer;
        }

        .use-location-button:hover {
          background: #EDF3FF;
          color: #3567D6;
        }

        .use-location-button svg {
          width: 14px;
          height: 14px;
        }

        .geo-map-wrapper {
          position: relative;
          overflow: hidden;
          margin-top: 18px;
          border: 1px solid #E0E3E8;
          border-radius: 11px;
          background: #F6F7F9;
        }

        .map-help {
          position: absolute;
          left: 10px;
          bottom: 10px;
          z-index: 500;
          padding: 6px 9px;
          border: 1px solid rgba(255,255,255,0.8);
          border-radius: 6px;
          background: rgba(255,255,255,0.94);
          color: #676C76;
          font-size: 9px;
          box-shadow: 0 2px 7px rgba(0,0,0,0.08);
        }

        .geo-radius-card {
          margin-top: 18px;
          padding: 15px;
          border: 1px solid #E4E7EC;
          border-radius: 10px;
          background: #FAFBFC;
        }

        .radius-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .radius-header strong {
          display: block;
          color: #343840;
          font-size: 12px;
        }

        .radius-header span {
          display: block;
          max-width: 500px;
          margin-top: 4px;
          color: #8A8F98;
          font-size: 10px;
        }

        .radius-value {
          min-width: 60px;
          padding: 6px 8px;
          border-radius: 7px;
          background: #EDF3FF;
          color: #3567D6;
          text-align: center;
          font-size: 12px;
          font-weight: 750;
        }

        .radius-slider {
          width: 100%;
          margin: 17px 0 4px;
          accent-color: #3567D6;
          cursor: pointer;
        }

        .radius-scale {
          display: flex;
          justify-content: space-between;
          color: #969BA5;
          font-size: 9px;
        }

        .geo-preview {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 17px;
          padding: 12px;
          border: 1px solid #DFE7F7;
          border-radius: 9px;
          background: #F5F8FF;
        }

        .geo-preview-icon {
          width: 29px;
          height: 29px;
          flex: 0 0 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #FFFFFF;
          color: #3567D6;
        }

        .geo-preview-icon svg {
          width: 15px;
          height: 15px;
        }

        .geo-preview strong {
          display: block;
          color: #343840;
          font-size: 11px;
        }

        .geo-preview span {
          display: block;
          margin-top: 3px;
          color: #737985;
          font-size: 10px;
          line-height: 1.45;
        }

        /* =========================
           Responsive
        ========================= */

        @media (max-width: 1150px) {
          .branch-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .branch-kpis {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 760px) {
          .branch-page {
            padding: 18px;
          }

          .branch-page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .branch-primary-button {
            width: 100%;
          }

          .branch-content {
            padding: 17px;
          }

          .branch-section-heading {
            align-items: flex-start;
          }

          .branch-grid {
            grid-template-columns: 1fr;
          }

          .branch-kpis {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 540px) {
          .branch-kpis {
            grid-template-columns: 1fr;
          }

          .branch-section-heading {
            flex-direction: column;
          }

          .branch-refresh-button {
            width: 100%;
            justify-content: center;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-field-full {
            grid-column: auto;
          }

          .location-search {
            flex-direction: column;
          }

          .location-search-button {
            width: 100%;
          }

          .geo-enable-card {
            align-items: flex-start;
          }

          .branch-form-footer,
          .geo-form-footer {
            flex-direction: column-reverse;
          }

          .branch-form-footer button,
          .geo-form-footer button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default BranchPage;