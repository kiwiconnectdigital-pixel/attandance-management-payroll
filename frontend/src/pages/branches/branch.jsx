import { useEffect, useRef, useState } from 'react';
import { branchAPI, employeeAPI } from '../../services/api';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  BuildingOffice2Icon,
  UsersIcon,
  MapPinIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  SignalIcon,
  GlobeAltIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  AdjustmentsHorizontalIcon,
  CrosshairIcon,
  MapIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

/* -------------------------------------------------------------------------- */
/* Leaflet marker                                                             */
/* -------------------------------------------------------------------------- */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* -------------------------------------------------------------------------- */
/* Map click                                                                  */
/* -------------------------------------------------------------------------- */

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => onMapClick(e.latlng),
  });

  return null;
};

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

const emptyForm = {
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
};

const emptyGeo = {
  enabled: false,
  latitude: '',
  longitude: '',
  radiusMeters: 100,
  address: '',
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const getId = (item) => item?.id ?? item?._id;

const getEmployeeCount = (response) => {
  return (
    response?.data?.data?.pagination?.total ??
    response?.data?.pagination?.total ??
    response?.data?.data?.total ??
    response?.data?.total ??
    0
  );
};

const formatAddress = (branch) => {
  return [
    branch?.address,
    branch?.city,
    branch?.state,
    branch?.pincode,
  ]
    .filter(Boolean)
    .join(', ');
};

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function BranchPage() {
  const [branches, setBranches] = useState([]);
  const [branchStats, setBranchStats] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [geoModal, setGeoModal] = useState(false);
  const [geoTarget, setGeoTarget] = useState(null);
  const [geoForm, setGeoForm] = useState(emptyGeo);
  const [geoLoading, setGeoLoading] = useState(false);

  const mapRef = useRef(null);

  /* ------------------------------------------------------------------------ */
  /* Fetch branches                                                           */
  /* ------------------------------------------------------------------------ */

  const fetchBranches = async () => {
    try {
      setPageLoading(true);

      const res = await branchAPI.getAll();

      const branchList =
        res?.data?.data?.branches ??
        res?.data?.data ??
        res?.data?.branches ??
        [];

      const safeBranches = Array.isArray(branchList)
        ? branchList
        : [];

      setBranches(safeBranches);

      const stats = {};

      await Promise.all(
        safeBranches.map(async (branch) => {
          const branchId = getId(branch);

          if (!branchId) return;

          try {
            const employeeResponse = await employeeAPI.getAll({
              branch: branchId,
              limit: 1,
            });

            stats[branchId] = getEmployeeCount(employeeResponse);
          } catch {
            stats[branchId] = 0;
          }
        })
      );

      setBranchStats(stats);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Failed to load branches'
      );
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Create / Edit                                                            */
  /* ------------------------------------------------------------------------ */

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (branch) => {
    setForm({
      name: branch?.name || '',
      code: branch?.code || '',
      address: branch?.address || '',
      city: branch?.city || '',
      state: branch?.state || '',
      pincode: branch?.pincode || '',
      phone: branch?.phone || '',
      email: branch?.email || '',
    });

    setEditingId(getId(branch));
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      if (editingId) {
        await branchAPI.update(editingId, form);
        toast.success('Branch updated successfully');
      } else {
        await branchAPI.create(form);
        toast.success('Branch created successfully');
      }

      setModalOpen(false);
      await fetchBranches();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Failed to save branch'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Delete / deactivate                                                      */
  /* ------------------------------------------------------------------------ */

  const handleDelete = async (id) => {
    if (!id) return;

    if (!window.confirm('Deactivate this branch?')) {
      return;
    }

    try {
      await branchAPI.delete(id);

      toast.success('Branch deactivated');

      await fetchBranches();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Failed to deactivate branch'
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Geofence                                                                  */
  /* ------------------------------------------------------------------------ */

  const openGeoModal = (branch) => {
    setGeoTarget(branch);

    const geo = branch?.geofence || {};

    setGeoForm({
      enabled: geo?.enabled ?? false,
      latitude: geo?.latitude ?? '',
      longitude: geo?.longitude ?? '',
      radiusMeters: geo?.radiusMeters ?? geo?.radius_meters ?? 100,
      address: geo?.address ?? '',
    });

    setGeoModal(true);
  };

  const handleMapClick = ({ lat, lng }) => {
    setGeoForm((current) => ({
      ...current,
      latitude: Number(lat.toFixed(7)),
      longitude: Number(lng.toFixed(7)),
    }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setGeoForm((current) => ({
          ...current,
          latitude,
          longitude,
        }));

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 17);
        }

        toast.success('Current location selected');
      },
      () => {
        toast.error('Unable to access your current location');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const handleGeoSave = async (e) => {
    e.preventDefault();

    if (!geoTarget) return;

    if (
      geoForm.enabled &&
      (!geoForm.latitude || !geoForm.longitude)
    ) {
      toast.error('Please select the office location');
      return;
    }

    setGeoLoading(true);

    try {
      await branchAPI.updateGeofence(getId(geoTarget), {
        ...geoForm,
        latitude:
          geoForm.latitude === ''
            ? ''
            : Number(geoForm.latitude),
        longitude:
          geoForm.longitude === ''
            ? ''
            : Number(geoForm.longitude),
        radiusMeters: Number(geoForm.radiusMeters),
      });

      toast.success('Geofence settings saved');

      setGeoModal(false);

      await fetchBranches();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          'Failed to save geofence settings'
      );
    } finally {
      setGeoLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Stats                                                                     */
  /* ------------------------------------------------------------------------ */

  const activeCount = branches.filter(
    (branch) => branch?.isActive !== false
  ).length;

  const inactiveCount = branches.length - activeCount;

  const geoCount = branches.filter(
    (branch) => branch?.geofence?.enabled
  ).length;

  const totalEmployees = Object.values(branchStats).reduce(
    (total, count) => total + Number(count || 0),
    0
  );

  const mapCenter =
    geoForm.latitude !== '' &&
    geoForm.longitude !== ''
      ? [
          Number(geoForm.latitude),
          Number(geoForm.longitude),
        ]
      : [20.5937, 78.9629];

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      <style>{`
        .branch-page {
          --bg: #F6F7F9;
          --surface: #FFFFFF;
          --surface-alt: #FAFBFC;
          --text: #15171C;
          --secondary: #676C76;
          --muted: #969BA5;
          --border: #E7E9ED;

          --blue: #3567D6;
          --blue-soft: #EDF3FF;

          --green: #16845B;
          --green-soft: #EAF7F1;

          --orange: #C97816;
          --orange-soft: #FFF4E5;

          --red: #C94B4B;
          --red-soft: #FDEEEE;

          --purple: #7357C8;
          --purple-soft: #F1EDFF;

          color: var(--text);
          background: var(--bg);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          min-height: 100%;
        }

        .branch-page * {
          box-sizing: border-box;
        }

        .branch-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          margin: 0 0 6px;
          color: var(--blue);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .09em;
          text-transform: uppercase;
        }

        .page-title {
          margin: 0;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: var(--text);
        }

        .page-subtitle {
          margin: 7px 0 0;
          color: var(--secondary);
          font-size: 14px;
          line-height: 1.5;
        }

        .primary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 42px;
          padding: 0 16px;
          border: 1px solid var(--blue);
          border-radius: 10px;
          background: var(--blue);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(53, 103, 214, .16);
          transition: all .18s ease;
        }

        .primary-btn:hover {
          background: #2f5ec8;
          transform: translateY(-1px);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .stat-card {
          position: relative;
          min-height: 118px;
          padding: 18px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, .025);
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .stat-label {
          color: var(--secondary);
          font-size: 12px;
          font-weight: 600;
        }

        .stat-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
        }

        .stat-value {
          margin: 14px 0 0;
          color: var(--text);
          font-size: 26px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -.025em;
        }

        .stat-meta {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 11px;
        }

        .workspace {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(16, 24, 40, .025);
        }

        .workspace-header {
          min-height: 68px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .workspace-title {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .workspace-title-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--blue-soft);
          color: var(--blue);
        }

        .workspace-title h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .workspace-title p {
          margin: 3px 0 0;
          color: var(--muted);
          font-size: 11px;
        }

        .branch-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          padding: 18px;
        }

        .branch-card {
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 13px;
          background: var(--surface);
          overflow: hidden;
          transition:
            border-color .18s ease,
            box-shadow .18s ease,
            transform .18s ease;
        }

        .branch-card:hover {
          border-color: #D9DDE5;
          box-shadow: 0 10px 26px rgba(16, 24, 40, .06);
          transform: translateY(-2px);
        }

        .branch-card-header {
          padding: 17px;
          border-bottom: 1px solid var(--border);
        }

        .branch-main {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .branch-identity {
          display: flex;
          gap: 11px;
          min-width: 0;
        }

        .branch-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: var(--blue-soft);
          color: var(--blue);
        }

        .branch-name {
          margin: 0;
          color: var(--text);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
          word-break: break-word;
        }

        .branch-code {
          display: inline-flex;
          margin-top: 5px;
          padding: 3px 7px;
          border-radius: 5px;
          background: var(--surface-alt);
          border: 1px solid var(--border);
          color: var(--secondary);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .05em;
        }

        .action-group {
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }

        .icon-btn {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          transition: all .15s ease;
        }

        .icon-btn:hover {
          background: var(--surface-alt);
          border-color: var(--border);
          color: var(--text);
        }

        .icon-btn.geo:hover {
          background: var(--purple-soft);
          border-color: #DED6FB;
          color: var(--purple);
        }

        .icon-btn.delete:hover {
          background: var(--red-soft);
          border-color: #F2CCCC;
          color: var(--red);
        }

        .branch-body {
          padding: 16px 17px;
        }

        .address-block {
          display: flex;
          gap: 9px;
          color: var(--secondary);
          font-size: 12px;
          line-height: 1.55;
        }

        .address-icon {
          flex: 0 0 16px;
          color: var(--muted);
        }

        .contact-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .contact-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          color: var(--secondary);
          font-size: 12px;
        }

        .contact-row svg {
          flex-shrink: 0;
          color: var(--muted);
        }

        .contact-row span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .geo-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 13px;
          padding: 6px 9px;
          border: 1px solid #DDEBE4;
          border-radius: 7px;
          background: var(--green-soft);
          color: var(--green);
          font-size: 10px;
          font-weight: 700;
        }

        .geo-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
        }

        .branch-footer {
          min-height: 47px;
          padding: 10px 17px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-top: 1px solid var(--border);
          background: var(--surface-alt);
        }

        .employee-count {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--secondary);
          font-size: 11px;
          font-weight: 500;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 700;
        }

        .status.active {
          color: var(--green);
          background: var(--green-soft);
        }

        .status.inactive {
          color: var(--red);
          background: var(--red-soft);
        }

        .empty-state {
          grid-column: 1 / -1;
          padding: 60px 20px;
          text-align: center;
          border: 1px dashed #D9DDE5;
          border-radius: 13px;
          background: var(--surface-alt);
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: var(--blue-soft);
          color: var(--blue);
        }

        .empty-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .empty-text {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 12px;
        }

        .skeleton {
          background:
            linear-gradient(
              90deg,
              #F1F3F5 25%,
              #E8EBEF 50%,
              #F1F3F5 75%
            );
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 7px;
        }

        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        /* ------------------------------------------------------------------ */
        /* Forms                                                               */
        /* ------------------------------------------------------------------ */

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .form-field {
          min-width: 0;
        }

        .form-field.full {
          grid-column: 1 / -1;
        }

        .form-label {
          display: block;
          margin-bottom: 6px;
          color: var(--secondary);
          font-size: 11px;
          font-weight: 700;
        }

        .required {
          color: var(--red);
        }

        .form-input {
          width: 100%;
          min-height: 40px;
          padding: 9px 11px;
          border: 1px solid var(--border);
          border-radius: 9px;
          outline: none;
          background: var(--surface);
          color: var(--text);
          font: inherit;
          font-size: 13px;
          transition:
            border-color .15s ease,
            box-shadow .15s ease;
        }

        .form-input::placeholder {
          color: #B2B6BE;
        }

        .form-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px rgba(53, 103, 214, .09);
        }

        textarea.form-input {
          resize: vertical;
          min-height: 78px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .secondary-btn {
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--surface);
          color: var(--secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .secondary-btn:hover {
          background: var(--surface-alt);
          color: var(--text);
        }

        .save-btn {
          min-height: 40px;
          padding: 0 17px;
          border: 1px solid var(--blue);
          border-radius: 9px;
          background: var(--blue);
          color: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .save-btn:hover:not(:disabled) {
          background: #2F5EC8;
        }

        .save-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        /* ------------------------------------------------------------------ */
        /* Geofence                                                           */
        /* ------------------------------------------------------------------ */

        .geo-intro {
          margin-bottom: 16px;
          padding: 13px 14px;
          display: flex;
          align-items: center;
          gap: 11px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-alt);
        }

        .geo-intro-icon {
          width: 35px;
          height: 35px;
          flex: 0 0 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--purple-soft);
          color: var(--purple);
        }

        .geo-intro-title {
          margin: 0;
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
        }

        .geo-intro-text {
          margin: 3px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.4;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 14px;
          margin-bottom: 15px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-alt);
          cursor: pointer;
        }

        .toggle-title {
          margin: 0;
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
        }

        .toggle-description {
          margin: 3px 0 0;
          color: var(--muted);
          font-size: 11px;
        }

        .toggle {
          width: 42px;
          height: 23px;
          flex-shrink: 0;
          position: relative;
          border-radius: 20px;
          cursor: pointer;
          transition: background .2s ease;
        }

        .toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,.18);
          transition: transform .2s ease;
        }

        .gps-btn {
          width: 100%;
          min-height: 40px;
          margin-bottom: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #D9D1F7;
          border-radius: 9px;
          background: var(--purple-soft);
          color: var(--purple);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .gps-btn:hover {
          background: #EAE4FF;
        }

        .map-wrapper {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 10px;
        }

        .map-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 33px;
          border-top: 1px solid var(--border);
          background: var(--surface-alt);
          color: var(--muted);
          font-size: 10px;
        }

        .coordinates {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 12px 0;
        }

        .coordinate-card {
          padding: 9px 11px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-alt);
        }

        .coordinate-label {
          display: block;
          margin-bottom: 3px;
          color: var(--muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .06em;
        }

        .coordinate-value {
          color: var(--text);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
        }

        .radius-card {
          margin-top: 15px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-alt);
        }

        .radius-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 11px;
        }

        .radius-title {
          color: var(--secondary);
          font-size: 11px;
          font-weight: 700;
        }

        .radius-value {
          color: var(--text);
          font-size: 17px;
          font-weight: 700;
        }

        .radius-value span {
          color: var(--muted);
          font-size: 10px;
          font-weight: 500;
        }

        .radius-range {
          width: 100%;
          accent-color: var(--purple);
        }

        .radius-scale {
          display: flex;
          justify-content: space-between;
          margin-top: 5px;
          color: var(--muted);
          font-size: 9px;
        }

        .helper-text {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.4;
        }

        /* ------------------------------------------------------------------ */
        /* Responsive                                                         */
        /* ------------------------------------------------------------------ */

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .branch-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .branch-page {
            padding: 0 !important;
          }

          .branch-header {
            align-items: stretch;
            flex-direction: column;
            gap: 15px;
          }

          .page-title {
            font-size: 25px;
          }

          .primary-btn {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .stat-card {
            min-height: 105px;
            padding: 14px;
          }

          .stat-value {
            font-size: 23px;
          }

          .branch-grid {
            grid-template-columns: 1fr;
            padding: 12px;
          }

          .workspace-header {
            padding: 14px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-field.full {
            grid-column: auto;
          }

          .coordinates {
            grid-template-columns: 1fr;
          }

          .modal-actions {
            flex-direction: column-reverse;
          }

          .secondary-btn,
          .save-btn {
            width: 100%;
          }
        }

        @media (max-width: 430px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .branch-card-header,
          .branch-card-body {
            padding: 14px;
          }

          .branch-footer {
            padding: 9px 14px;
          }
        }
      `}</style>

      <div className="branch-page" style={{ padding: '0 4px' }}>
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                             */}
        {/* ------------------------------------------------------------------ */}

        <div className="branch-header">
          <div>
            <p className="eyebrow">Organisation setup</p>

            <h1 className="page-title">
              Branches
            </h1>

            <p className="page-subtitle">
              Manage offices, employee allocation and attendance locations.
            </p>
          </div>

          <button
            type="button"
            className="primary-btn"
            onClick={openCreate}
          >
            <PlusIcon width={17} height={17} />
            Add branch
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* KPI Cards                                                          */}
        {/* ------------------------------------------------------------------ */}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Total branches
              </span>

              <div
                className="stat-icon"
                style={{
                  background: 'var(--blue-soft)',
                  color: 'var(--blue)',
                }}
              >
                <BuildingOffice2Icon width={18} />
              </div>
            </div>

            <p className="stat-value">
              {branches.length}
            </p>

            <p className="stat-meta">
              {activeCount} active
              {inactiveCount > 0
                ? ` · ${inactiveCount} inactive`
                : ''}
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Employees
              </span>

              <div
                className="stat-icon"
                style={{
                  background: 'var(--green-soft)',
                  color: 'var(--green)',
                }}
              >
                <UsersIcon width={18} />
              </div>
            </div>

            <p className="stat-value">
              {totalEmployees}
            </p>

            <p className="stat-meta">
              Employees assigned across branches
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Geofenced
              </span>

              <div
                className="stat-icon"
                style={{
                  background: 'var(--purple-soft)',
                  color: 'var(--purple)',
                }}
              >
                <MapPinIcon width={18} />
              </div>
            </div>

            <p className="stat-value">
              {geoCount}
            </p>

            <p className="stat-meta">
              Attendance locations protected
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">
                Active branches
              </span>

              <div
                className="stat-icon"
                style={{
                  background: 'var(--orange-soft)',
                  color: 'var(--orange)',
                }}
              >
                <CheckCircleIcon width={18} />
              </div>
            </div>

            <p className="stat-value">
              {activeCount}
            </p>

            <p className="stat-meta">
              Currently available for operations
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Branch workspace                                                   */}
        {/* ------------------------------------------------------------------ */}

        <section className="workspace">
          <div className="workspace-header">
            <div className="workspace-title">
              <div className="workspace-title-icon">
                <BuildingOffice2Icon width={19} />
              </div>

              <div>
                <h2>Branch directory</h2>
                <p>
                  Office locations and attendance configuration
                </p>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Loading                                                         */}
          {/* -------------------------------------------------------------- */}

          {pageLoading ? (
            <div className="branch-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="branch-card"
                  style={{ minHeight: 220 }}
                >
                  <div
                    style={{
                      padding: 17,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="skeleton"
                      style={{
                        width: '45%',
                        height: 16,
                        marginBottom: 9,
                      }}
                    />

                    <div
                      className="skeleton"
                      style={{
                        width: '24%',
                        height: 12,
                      }}
                    />
                  </div>

                  <div style={{ padding: 17 }}>
                    <div
                      className="skeleton"
                      style={{
                        width: '90%',
                        height: 12,
                        marginBottom: 9,
                      }}
                    />

                    <div
                      className="skeleton"
                      style={{
                        width: '65%',
                        height: 12,
                        marginBottom: 20,
                      }}
                    />

                    <div
                      className="skeleton"
                      style={{
                        width: '55%',
                        height: 11,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="branch-grid">
              {branches.map((branch) => {
                const id = getId(branch);
                const employeeCount = branchStats[id] ?? 0;
                const isActive = branch?.isActive !== false;
                const geofenceEnabled =
                  branch?.geofence?.enabled === true;

                return (
                  <article
                    key={id}
                    className="branch-card"
                  >
                    {/* ------------------------------------------------------ */}
                    {/* Card Header                                             */}
                    {/* ------------------------------------------------------ */}

                    <div className="branch-card-header">
                      <div className="branch-main">
                        <div className="branch-identity">
                          <div className="branch-icon">
                            <BuildingOffice2Icon width={19} />
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <h3 className="branch-name">
                              {branch?.name || 'Unnamed branch'}
                            </h3>

                            {branch?.code && (
                              <span className="branch-code">
                                {branch.code}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="action-group">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openEdit(branch)}
                            title="Edit branch"
                          >
                            <PencilSquareIcon width={16} />
                          </button>

                          <button
                            type="button"
                            className="icon-btn geo"
                            onClick={() => openGeoModal(branch)}
                            title="Configure geofence"
                          >
                            <MapIcon width={16} />
                          </button>

                          <button
                            type="button"
                            className="icon-btn delete"
                            onClick={() => handleDelete(id)}
                            title="Deactivate branch"
                          >
                            <TrashIcon width={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ------------------------------------------------------ */}
                    {/* Card Body                                               */}
                    {/* ------------------------------------------------------ */}

                    <div className="branch-body">
                      <div className="address-block">
                        <MapPinIcon
                          className="address-icon"
                          width={16}
                        />

                        <span>
                          {formatAddress(branch) ||
                            'Address not available'}
                        </span>
                      </div>

                      {(branch?.phone || branch?.email) && (
                        <div className="contact-list">
                          {branch?.phone && (
                            <div className="contact-row">
                              <PhoneIcon width={14} />
                              <span>{branch.phone}</span>
                            </div>
                          )}

                          {branch?.email && (
                            <div className="contact-row">
                              <EnvelopeIcon width={14} />
                              <span>{branch.email}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {geofenceEnabled && (
                        <div className="geo-status">
                          <span className="geo-status-dot" />

                          <SignalIcon width={12} />

                          <span>
                            Geofence active ·{' '}
                            {branch?.geofence?.radiusMeters ??
                              branch?.geofence?.radius_meters ??
                              100}
                            m
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ------------------------------------------------------ */}
                    {/* Footer                                                  */}
                    {/* ------------------------------------------------------ */}

                    <div className="branch-footer">
                      <div className="employee-count">
                        <UsersIcon width={14} />

                        <span>
                          {employeeCount}{' '}
                          {employeeCount === 1
                            ? 'employee'
                            : 'employees'}
                        </span>
                      </div>

                      <span
                        className={`status ${
                          isActive
                            ? 'active'
                            : 'inactive'
                        }`}
                      >
                        {isActive ? (
                          <CheckCircleIcon width={13} />
                        ) : (
                          <XCircleIcon width={13} />
                        )}

                        {isActive
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </div>
                  </article>
                );
              })}

              {/* ------------------------------------------------------------ */}
              {/* Empty state                                                  */}
              {/* ------------------------------------------------------------ */}

              {branches.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <BuildingOffice2Icon width={23} />
                  </div>

                  <p className="empty-title">
                    No branches found
                  </p>

                  <p className="empty-text">
                    Create your first branch to start managing
                    office locations.
                  </p>

                  <button
                    type="button"
                    className="primary-btn"
                    style={{
                      margin: '18px auto 0',
                    }}
                    onClick={openCreate}
                  >
                    <PlusIcon width={16} />
                    Add branch
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ================================================================== */}
        {/* CREATE / EDIT BRANCH MODAL                                         */}
        {/* ================================================================== */}

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingId ? 'Edit branch' : 'Create branch'}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field full">
                <label className="form-label">
                  Branch name
                  <span className="required"> *</span>
                </label>

                <input
                  className="form-input"
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Head Office"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">
                  Branch code
                  <span className="required"> *</span>
                </label>

                <input
                  className="form-input"
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      code: e.target.value,
                    }))
                  }
                  placeholder="HQ"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">
                  Phone
                </label>

                <input
                  className="form-input"
                  type="text"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="form-field">
                <label className="form-label">
                  City
                  <span className="required"> *</span>
                </label>

                <input
                  className="form-input"
                  type="text"
                  value={form.city}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      city: e.target.value,
                    }))
                  }
                  placeholder="Indore"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">
                  State
                  <span className="required"> *</span>
                </label>

                <input
                  className="form-input"
                  type="text"
                  value={form.state}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      state: e.target.value,
                    }))
                  }
                  placeholder="Madhya Pradesh"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">
                  Pincode
                </label>

                <input
                  className="form-input"
                  type="text"
                  value={form.pincode}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      pincode: e.target.value,
                    }))
                  }
                  placeholder="452001"
                />
              </div>

              <div className="form-field">
                <label className="form-label">
                  Email
                </label>

                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      email: e.target.value,
                    }))
                  }
                  placeholder="branch@company.com"
                />
              </div>

              <div className="form-field full">
                <label className="form-label">
                  Full address
                  <span className="required"> *</span>
                </label>

                <textarea
                  className="form-input"
                  value={form.address}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Office address, building, street"
                  required
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-btn"
                disabled={loading}
              >
                {loading
                  ? 'Saving...'
                  : editingId
                    ? 'Update branch'
                    : 'Create branch'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ================================================================== */}
        {/* GEOFENCE MODAL                                                     */}
        {/* ================================================================== */}

        <Modal
          isOpen={geoModal}
          onClose={() => setGeoModal(false)}
          title={`Geofence · ${geoTarget?.name || ''}`}
        >
          <form onSubmit={handleGeoSave}>
            <div className="geo-intro">
              <div className="geo-intro-icon">
                <GlobeAltIcon width={18} />
              </div>

              <div>
                <p className="geo-intro-title">
                  Attendance location control
                </p>

                <p className="geo-intro-text">
                  Define the area from which employees are
                  allowed to check in and check out.
                </p>
              </div>
            </div>

            {/* Toggle */}

            <div
              className="toggle-row"
              onClick={() =>
                setGeoForm((current) => ({
                  ...current,
                  enabled: !current.enabled,
                }))
              }
            >
              <div>
                <p className="toggle-title">
                  Enable geofencing
                </p>

                <p className="toggle-description">
                  Restrict attendance activity to the
                  configured office radius.
                </p>
              </div>

              <div
                className="toggle"
                style={{
                  background: geoForm.enabled
                    ? 'var(--purple)'
                    : '#D4D7DC',
                }}
              >
                <div
                  className="toggle-thumb"
                  style={{
                    transform: geoForm.enabled
                      ? 'translateX(19px)'
                      : 'translateX(0)',
                  }}
                />
              </div>
            </div>

            {geoForm.enabled && (
              <>
                {/* Current location */}

                <button
                  type="button"
                  className="gps-btn"
                  onClick={useMyLocation}
                >
                  <CrosshairIcon width={16} />
                  Use my current location
                </button>

                {/* Map */}

                <div className="map-wrapper">
                  <MapContainer
                    center={mapCenter}
                    zoom={
                      geoForm.latitude &&
                      geoForm.longitude
                        ? 16
                        : 5
                    }
                    style={{
                      height: 270,
                      width: '100%',
                    }}
                    ref={mapRef}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapClickHandler
                      onMapClick={handleMapClick}
                    />

                    {geoForm.latitude !== '' &&
                      geoForm.longitude !== '' && (
                        <>
                          <Marker
                            position={[
                              Number(geoForm.latitude),
                              Number(geoForm.longitude),
                            ]}
                          />

                          <Circle
                            center={[
                              Number(geoForm.latitude),
                              Number(geoForm.longitude),
                            ]}
                            radius={Number(
                              geoForm.radiusMeters
                            )}
                            pathOptions={{
                              color: '#7357C8',
                              fillColor: '#7357C8',
                              fillOpacity: 0.1,
                              weight: 2,
                            }}
                          />
                        </>
                      )}
                  </MapContainer>

                  <div className="map-hint">
                    <MapPinIcon width={13} />
                    Click anywhere on the map to set
                    the office location
                  </div>
                </div>

                {/* Coordinates */}

                {geoForm.latitude !== '' &&
                  geoForm.longitude !== '' && (
                    <div className="coordinates">
                      <div className="coordinate-card">
                        <span className="coordinate-label">
                          LATITUDE
                        </span>

                        <span className="coordinate-value">
                          {Number(
                            geoForm.latitude
                          ).toFixed(6)}
                        </span>
                      </div>

                      <div className="coordinate-card">
                        <span className="coordinate-label">
                          LONGITUDE
                        </span>

                        <span className="coordinate-value">
                          {Number(
                            geoForm.longitude
                          ).toFixed(6)}
                        </span>
                      </div>
                    </div>
                  )}

                {/* Manual coordinates */}

                <div
                  className="form-grid"
                  style={{ marginTop: 12 }}
                >
                  <div className="form-field">
                    <label className="form-label">
                      Latitude
                    </label>

                    <input
                      className="form-input"
                      type="number"
                      step="any"
                      value={geoForm.latitude}
                      onChange={(e) =>
                        setGeoForm((current) => ({
                          ...current,
                          latitude:
                            e.target.value,
                        }))
                      }
                      placeholder="22.7196"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">
                      Longitude
                    </label>

                    <input
                      className="form-input"
                      type="number"
                      step="any"
                      value={geoForm.longitude}
                      onChange={(e) =>
                        setGeoForm((current) => ({
                          ...current,
                          longitude:
                            e.target.value,
                        }))
                      }
                      placeholder="75.8577"
                      required
                    />
                  </div>
                </div>

                {/* Radius */}

                <div className="radius-card">
                  <div className="radius-header">
                    <span className="radius-title">
                      Allowed attendance radius
                    </span>

                    <span className="radius-value">
                      {geoForm.radiusMeters}
                      <span> metres</span>
                    </span>
                  </div>

                  <input
                    className="radius-range"
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={geoForm.radiusMeters}
                    onChange={(e) =>
                      setGeoForm((current) => ({
                        ...current,
                        radiusMeters: Number(
                          e.target.value
                        ),
                      }))
                    }
                  />

                  <div className="radius-scale">
                    <span>50m</span>
                    <span>500m</span>
                    <span>1000m</span>
                  </div>
                </div>

                {/* Address label */}

                <div
                  className="form-field"
                  style={{ marginTop: 15 }}
                >
                  <label className="form-label">
                    Office location label
                  </label>

                  <input
                    className="form-input"
                    type="text"
                    value={geoForm.address}
                    onChange={(e) =>
                      setGeoForm((current) => ({
                        ...current,
                        address: e.target.value,
                      }))
                    }
                    placeholder="MP Nagar, Bhopal office"
                  />

                  <p className="helper-text">
                    This label can be displayed when an
                    employee is outside the allowed area.
                  </p>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setGeoModal(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-btn"
                disabled={geoLoading}
              >
                {geoLoading
                  ? 'Saving...'
                  : 'Save geofence'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
}