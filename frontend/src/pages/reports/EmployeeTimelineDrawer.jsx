import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
} from '@heroicons/react/24/outline';

import toast from 'react-hot-toast';
import api, { attendanceAPI } from '../../services/api';

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function toNum(value) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

const SOURCE_COLOR = {
  checkin: '#16845B',
  checkout: '#C94B4B',
  periodic: '#3567D6',
};

const SOURCE_LABEL = {
  checkin: 'Check-in',
  checkout: 'Check-out',
  periodic: 'Location ping',
};

function fmtTime(iso) {
  return iso
    ? new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

function fmtDate(date) {
  if (!date) return '—';

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getEmployeeId(employee) {
  return employee?.id ?? employee?._id;
}

function getEmployeeCode(employee) {
  return employee?.employeeCode || employee?.employee_code || '';
}

function getWorkingHours(record) {
  return (
    record?.workingHours ??
    record?.working_hours ??
    record?.totalWorkingHours ??
    record?.total_working_hours ??
    '—'
  );
}

function getOvertime(record) {
  return (
    record?.overtimeHours ??
    record?.overtime_hours ??
    record?.overtime ??
    '—'
  );
}

function getStatus(record) {
  return record?.status || record?.attendance_status || '—';
}

/* -------------------------------------------------------------------------- */
/* CUSTOM MARKER                                                              */
/* -------------------------------------------------------------------------- */

function eventIcon(color, type) {
  const label = type === 'checkin' ? 'IN' : 'OUT';

  return L.divIcon({
    className: '',
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

/* -------------------------------------------------------------------------- */
/* FIT MAP                                                                    */
/* -------------------------------------------------------------------------- */

function FitToPoints({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    if (points.length === 1) {
      map.setView(
        [points[0].latitude, points[0].longitude],
        16
      );
    } else {
      map.fitBounds(
        points.map((point) => [
          point.latitude,
          point.longitude,
        ]),
        {
          padding: [70, 70],
        }
      );
    }
  }, [points, map]);

  return null;
}

/* -------------------------------------------------------------------------- */
/* DIRECTION ARROWS                                                           */
/* -------------------------------------------------------------------------- */

function DirectionArrows({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length < 2) return;

    const arrowLayer = L.layerGroup();

    const step = Math.max(
      1,
      Math.floor(points.length / 12)
    );

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
          to.latitude - from.latitude
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
            className: '',
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
        }
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

/* -------------------------------------------------------------------------- */
/* STAT CARD                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'blue',
}) {
  const tones = {
    blue: {
      bg: '#EDF3FF',
      icon: '#3567D6',
    },
    green: {
      bg: '#EAF7F1',
      icon: '#16845B',
    },
    orange: {
      bg: '#FFF4E5',
      icon: '#C97816',
    },
    red: {
      bg: '#FDEEEE',
      icon: '#C94B4B',
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

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                                             */
/* -------------------------------------------------------------------------- */

export default function EmployeeTimelineDrawer({
  onClose,
}) {
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState('');

  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [trail, setTrail] = useState([]);
  const [attendanceMeta, setAttendanceMeta] =
    useState(null);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* LOAD EMPLOYEES                                                           */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/employees');

        const payload = res.data;

        const list =
          (Array.isArray(payload?.data?.employees) &&
            payload.data.employees) ||
          (Array.isArray(payload?.data?.records) &&
            payload.data.records) ||
          (Array.isArray(payload?.data) &&
            payload.data) ||
          (Array.isArray(payload?.employees) &&
            payload.employees) ||
          (Array.isArray(payload) && payload) ||
          [];

        setEmployees(list);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load employee list');
        setEmployees([]);
      } finally {
        setEmpLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------------ */
  /* LOAD TIMELINE                                                            */
  /* ------------------------------------------------------------------------ */

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

      const record =
        attRes.data?.data?.records?.[0];

      if (!record) {
        toast.error(
          'No attendance record for this employee on that date'
        );
        return;
      }

      setAttendanceMeta(record);

      const attendanceId =
        record.id || record._id;

      const trailRes = await api.get(
        `/attendance/${attendanceId}/location-trail`
      );

      const trailPayload = trailRes.data;

      const points =
        (Array.isArray(
          trailPayload?.data?.points
        ) &&
          trailPayload.data.points) ||
        (Array.isArray(trailPayload?.points) &&
          trailPayload.points) ||
        (Array.isArray(trailPayload?.data) &&
          trailPayload.data) ||
        [];

      const normalized = points
        .map((point) => ({
          ...point,
          latitude: toNum(point.latitude),
          longitude: toNum(point.longitude),
        }))
        .filter(
          (point) =>
            point.latitude !== null &&
            point.longitude !== null
        )
        .sort(
          (a, b) =>
            new Date(a.recorded_at) -
            new Date(b.recorded_at)
        );

      setTrail(normalized);
    } catch (error) {
      console.error(error);

      toast.error(
        'Failed to load location timeline'
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId, date]);

  useEffect(() => {
    if (employeeId) {
      loadTimeline();
    }
  }, [employeeId, date, loadTimeline]);

  /* ------------------------------------------------------------------------ */
  /* DERIVED DATA                                                             */
  /* ------------------------------------------------------------------------ */

  const polylinePositions = useMemo(
    () =>
      trail.map((point) => [
        point.latitude,
        point.longitude,
      ]),
    [trail]
  );

  const eventPoints = useMemo(
    () =>
      trail.filter(
        (point) =>
          point.source === 'checkin' ||
          point.source === 'checkout'
      ),
    [trail]
  );

  const selectedEmployee = employees.find(
    (employee) =>
      String(getEmployeeId(employee)) ===
      String(employeeId)
  );

  const checkInPoint = trail.find(
    (point) => point.source === 'checkin'
  );

  const checkOutPoint = [...trail]
    .reverse()
    .find(
      (point) => point.source === 'checkout'
    );

  const status = getStatus(attendanceMeta);

  const isPresent =
    String(status).toLowerCase() === 'present';

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

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
      `}</style>

      <div
        className="etl-overlay"
        onClick={onClose}
      />

      <div className="etl-drawer">
        {/* ---------------------------------------------------------------- */}
        {/* HEADER                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="etl-header">
          <div className="etl-header-left">
            <div className="etl-header-icon">
              <MapPinIcon />
            </div>

            <div>
              <div className="etl-title">
                Employee Movement
              </div>

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

        {/* ---------------------------------------------------------------- */}
        {/* TOOLBAR                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="etl-toolbar">
          <div className="etl-field">
            <UserIcon className="etl-field-icon" />

            <select
              className="etl-select"
              value={employeeId}
              onChange={(event) =>
                setEmployeeId(event.target.value)
              }
              disabled={empLoading}
            >
              <option value="">
                {empLoading
                  ? 'Loading employees...'
                  : 'Select employee'}
              </option>

              {employees.map((employee) => {
                const id = getEmployeeId(employee);
                const code = getEmployeeCode(employee);

                return (
                  <option
                    key={id}
                    value={id}
                  >
                    {employee.name}

                    {code
                      ? ` (${code})`
                      : ''}
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
              max={
                new Date()
                  .toISOString()
                  .slice(0, 10)
              }
              onChange={(event) =>
                setDate(event.target.value)
              }
            />
          </div>

          {selectedEmployee && (
            <div className="etl-employee-chip">
              <div className="etl-chip-avatar">
                {selectedEmployee.name
                  ?.charAt(0)
                  ?.toUpperCase() || 'E'}
              </div>

              <span>Viewing</span>

              <span className="etl-chip-name">
                {selectedEmployee.name}
              </span>
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
                animation: loading
                  ? 'etlSpin .8s linear infinite'
                  : 'none',
              }}
            />
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* CONTENT                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="etl-content">
          {/* ============================================================ */}
          {/* LEFT / MAP                                                    */}
          {/* ============================================================ */}

          <div className="etl-left">
            {selectedEmployee && (
              <div className="etl-context">
                <div className="etl-context-left">
                  <div className="etl-context-avatar">
                    {selectedEmployee.name
                      ?.split(' ')
                      .slice(0, 2)
                      .map((part) =>
                        part.charAt(0)
                      )
                      .join('')
                      .toUpperCase() || 'E'}
                  </div>

                  <div>
                    <div className="etl-context-name">
                      {selectedEmployee.name}
                    </div>

                    <div className="etl-context-meta">
                      {getEmployeeCode(
                        selectedEmployee
                      ) || 'Employee'}{' '}
                      {selectedEmployee.department
                        ? `• ${selectedEmployee.department}`
                        : ''}
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

                  <span>
                    Loading movement history...
                  </span>
                </div>
              ) : trail.length === 0 ? (
                <div className="etl-map-empty">
                  <div className="etl-map-empty-icon">
                    <MapPinIcon />
                  </div>

                  <div>
                    {!searched
                      ? 'Select an employee to view their movement history'
                      : 'No location points recorded for this day'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="etl-map-legend">
                    <div className="etl-legend-item">
                      <span
                        className="etl-legend-dot"
                        style={{
                          background:
                            SOURCE_COLOR.checkin,
                        }}
                      />

                      Check-in
                    </div>

                    <div className="etl-legend-item">
                      <span
                        className="etl-legend-dot"
                        style={{
                          background:
                            SOURCE_COLOR.checkout,
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
                    onClick={() => {
                      // FitToPoints handles the actual map bounds.
                      // This button intentionally remains lightweight.
                    }}
                  >
                    <ArrowsPointingOutIcon />
                  </button>

                  <MapContainer
                    center={[
                      trail[0].latitude,
                      trail[0].longitude,
                    ]}
                    zoom={15}
                    style={{
                      height: '100%',
                      width: '100%',
                    }}
                    scrollWheelZoom
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />

                    <FitToPoints
                      points={trail}
                    />

                    <Polyline
                      positions={
                        polylinePositions
                      }
                      pathOptions={{
                        color: '#3567D6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />

                    <DirectionArrows
                      points={trail}
                    />

                    {eventPoints.map(
                      (point, index) => {
                        const type =
                          point.source;

                        return (
                          <Marker
                            key={`${type}-${index}`}
                            position={[
                              point.latitude,
                              point.longitude,
                            ]}
                            icon={eventIcon(
                              SOURCE_COLOR[type],
                              type
                            )}
                          >
                            <Popup>
                              <div
                                style={{
                                  fontFamily:
                                    'Arial, sans-serif',
                                  fontSize: 12,
                                  lineHeight: 1.6,
                                  minWidth: 170,
                                  color: '#15171C',
                                }}
                              >
                                <strong>
                                  {
                                    SOURCE_LABEL[
                                      type
                                    ]
                                  }
                                </strong>

                                <br />

                                {fmtTime(
                                  point.recorded_at
                                )}

                                <br />

                                {point.address ||
                                  `${point.latitude?.toFixed(
                                    5
                                  )}, ${point.longitude?.toFixed(
                                    5
                                  )}`}

                                {point.accuracy_meters && (
                                  <>
                                    <br />
                                    Accuracy: ±
                                    {Math.round(
                                      point.accuracy_meters
                                    )}
                                    m
                                  </>
                                )}
                              </div>
                            </Popup>
                          </Marker>
                        );
                      }
                    )}
                  </MapContainer>
                </>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* RIGHT / HR REPORTING PANEL                                   */}
          {/* ============================================================ */}

          <aside className="etl-right">
            <div className="etl-right-header">
              <div>
                <div className="etl-section-title">
                  Movement history
                </div>

                <div className="etl-section-subtitle">
                  Daily attendance activity
                </div>
              </div>

              <div className="etl-point-count">
                {trail.length}
              </div>
            </div>

            {attendanceMeta && (
              <>
                <div className="etl-summary">
                  <StatCard
                    icon={CheckCircleIcon}
                    label="Status"
                    value={
                      getStatus(
                        attendanceMeta
                      )
                    }
                    tone={
                      isPresent
                        ? 'green'
                        : 'blue'
                    }
                  />

                  <StatCard
                    icon={MapPinIcon}
                    label="Location points"
                    value={trail.length}
                    tone="blue"
                  />

                  <StatCard
                    icon={ClockIcon}
                    label="Working hours"
                    value={getWorkingHours(
                      attendanceMeta
                    )}
                    tone="orange"
                  />

                  <StatCard
                    icon={ArrowRightIcon}
                    label="Overtime"
                    value={getOvertime(
                      attendanceMeta
                    )}
                    tone="green"
                  />
                </div>

                <div className="etl-status">
                  <div className="etl-status-left">
                    <span className="etl-status-dot" />

                    <span className="etl-status-label">
                      Attendance status
                    </span>
                  </div>

                  <span className="etl-status-value">
                    {getStatus(
                      attendanceMeta
                    )}
                  </span>
                </div>
              </>
            )}

            {!attendanceMeta && (
              <div className="etl-empty-timeline">
                Select an employee and date to
                view attendance activity.
              </div>
            )}

            {trail.length > 0 && (
              <>
                <div className="etl-right-header">
                  <div>
                    <div className="etl-section-title">
                      Activity log
                    </div>

                    <div className="etl-section-subtitle">
                      Recorded location events
                    </div>
                  </div>
                </div>

                <div className="etl-timeline">
                  {trail.map(
                    (point, index) => {
                      const color =
                        SOURCE_COLOR[
                          point.source
                        ] || '#3567D6';

                      const isPeriodic =
                        point.source ===
                        'periodic';

                      return (
                        <div
                          key={`${point.recorded_at}-${index}`}
                          className="etl-timeline-item"
                        >
                          <div
                            className={`etl-timeline-dot ${
                              isPeriodic
                                ? 'periodic'
                                : ''
                            }`}
                            style={{
                              background:
                                isPeriodic
                                  ? undefined
                                  : color,
                            }}
                          />

                          <div className="etl-timeline-body">
                            <div className="etl-timeline-top">
                              <span className="etl-time">
                                <ClockIcon />

                                {fmtTime(
                                  point.recorded_at
                                )}
                              </span>

                              {!isPeriodic && (
                                <span
                                  className="etl-badge"
                                  style={{
                                    color,
                                    background:
                                      `${color}12`,
                                    border:
                                      `1px solid ${color}28`,
                                  }}
                                >
                                  {
                                    SOURCE_LABEL[
                                      point.source
                                    ]
                                  }
                                </span>
                              )}
                            </div>

                            <div className="etl-location">
                              <MapPinIcon />

                              <span>
                                {point.address ||
                                  `${point.latitude?.toFixed(
                                    5
                                  )}, ${point.longitude?.toFixed(
                                    5
                                  )}`}
                              </span>
                            </div>

                            {point.accuracy_meters && (
                              <div className="etl-accuracy">
                                Location accuracy ±
                                {Math.round(
                                  point.accuracy_meters
                                )}
                                m
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </>
            )}

            {trail.length === 0 &&
              attendanceMeta && (
                <div className="etl-empty-timeline">
                  No movement locations were recorded
                  for this attendance record.
                </div>
              )}

            {checkInPoint && (
              <div
                style={{
                  marginTop: 20,
                  padding: 12,
                  border: '1px solid #E7E9ED',
                  borderRadius: 10,
                  background: '#FAFBFC',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 10,
                    color: '#969BA5',
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
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
                    display: 'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: '#969BA5',
                      }}
                    >
                      Check-in
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#16845B',
                      }}
                    >
                      <CheckCircleIcon
                        style={{
                          width: 14,
                          height: 14,
                        }}
                      />

                      {fmtTime(
                        checkInPoint.recorded_at
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: '#969BA5',
                      }}
                    >
                      Check-out
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: 700,
                        color: checkOutPoint
                          ? '#C94B4B'
                          : '#969BA5',
                      }}
                    >
                      <ArrowLeftOnRectangleIcon
                        style={{
                          width: 14,
                          height: 14,
                        }}
                      />

                      {checkOutPoint
                        ? fmtTime(
                            checkOutPoint.recorded_at
                          )
                        : 'Not recorded'}
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