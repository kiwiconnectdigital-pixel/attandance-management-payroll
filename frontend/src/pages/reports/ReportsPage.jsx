
import { useEffect, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  DocumentChartBarIcon,
  InformationCircleIcon,
  MapPinIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getMonthOptions } from '../../utils/helpers';
import EmployeeTimelineDrawer from './EmployeeTimelineDrawer';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const BASE_URL = 'https://attendance-backend.kiwiconnectdigital.com';

const COLORS = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFBFC',
  text: '#15171C',
  secondary: '#676C76',
  muted: '#969BA5',
  border: '#E7E9ED',
  blue: '#3567D6',
  blueSoft: '#EDF3FF',
  green: '#16845B',
  greenSoft: '#EAF7F1',
  orange: '#C97816',
  orangeSoft: '#FFF4E5',
  red: '#C94B4B',
  redSoft: '#FDEEEE',
  purple: '#7357C8',
  purpleSoft: '#F1EDFF',
};

const getStatusMeta = (status) => {
  const value = String(status || '').toLowerCase();

  if (value === 'present') {
    return {
      label: 'Present',
      color: COLORS.green,
      bg: COLORS.greenSoft,
    };
  }

  if (value === 'late') {
    return {
      label: 'Late',
      color: COLORS.orange,
      bg: COLORS.orangeSoft,
    };
  }

  if (value === 'absent') {
    return {
      label: 'Absent',
      color: COLORS.red,
      bg: COLORS.redSoft,
    };
  }

  if (value === 'half-day' || value === 'half day') {
    return {
      label: 'Half day',
      color: COLORS.blue,
      bg: COLORS.blueSoft,
    };
  }

  if (value === 'holiday') {
    return {
      label: 'Holiday',
      color: COLORS.purple,
      bg: COLORS.purpleSoft,
    };
  }

  return {
    label: status || 'Unknown',
    color: COLORS.secondary,
    bg: '#F1F2F4',
  };
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0])
    .join('')
    .toUpperCase() || '?';

const formatTime = (value) => {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const formatDate = (value) => {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
};

const formatHours = (value) => {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);

  if (!Number.isFinite(number)) return value;

  return `${number.toFixed(1)}h`;
};

const getLocationLabel = (location) => {
  if (!location) return '';

  if (location.address) return location.address;

  if (
    location.latitude !== undefined &&
    location.longitude !== undefined
  ) {
    return `${Number(location.latitude).toFixed(3)}, ${Number(
      location.longitude
    ).toFixed(3)}`;
  }

  return '';
};

/* -------------------------------------------------------------------------- */
/* Lightbox                                                                   */
/* -------------------------------------------------------------------------- */

function Lightbox({ src, onClose }) {
  return (
    <div
      style={styles.lightboxOverlay}
      onClick={onClose}
      role="presentation"
    >
      <img
        src={src}
        alt="Attendance selfie"
        style={styles.lightboxImage}
        onClick={(event) => event.stopPropagation()}
      />

      <button
        type="button"
        onClick={onClose}
        style={styles.lightboxClose}
        aria-label="Close image"
      >
        <XMarkIcon style={{ width: 20, height: 20 }} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared Spinner                                                             */
/* -------------------------------------------------------------------------- */

function Spinner({ small = false }) {
  return (
    <span
      style={{
        width: small ? 14 : 24,
        height: small ? 14 : 24,
        borderRadius: '50%',
        border: `2px solid ${COLORS.border}`,
        borderTopColor: COLORS.blue,
        display: 'inline-block',
        animation: 'reportsSpin 0.7s linear infinite',
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Attendance Drawer                                                          */
/* -------------------------------------------------------------------------- */

function AttendanceDrawer({ params, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const LIMIT = 20;

  const fetchPage = async (pageNumber) => {
    setLoading(true);

    try {
      const response = await api.get('/attendance/all-detailed', {
        params: {
          month: params.month,
          year: params.year,
          page: pageNumber,
          limit: LIMIT,
        },
      });

      setRecords(response.data?.data || []);
      setTotal(Number(response.data?.total || 0));
      setPage(pageNumber);
    } catch {
      toast.error('Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
  }, [params.month, params.year]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      {lightbox && (
        <Lightbox
          src={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <div
        style={styles.drawerOverlay}
        onClick={onClose}
        role="presentation"
      />

      <aside style={styles.drawer}>
        <div style={styles.drawerHeader}>
          <div>
            <div style={styles.drawerEyebrow}>Attendance records</div>

            <h2 style={styles.drawerTitle}>
              Detailed attendance
            </h2>

            <p style={styles.drawerSubtitle}>
              {new Date(
                params.year,
                params.month - 1
              ).toLocaleString('en-IN', {
                month: 'long',
                year: 'numeric',
              })}

              {total > 0 && ` · ${total} records`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.iconButton}
          >
            <XMarkIcon style={{ width: 19, height: 19 }} />
          </button>
        </div>

        <div style={styles.drawerBody}>
          {loading ? (
            <div style={styles.centerState}>
              <Spinner />
              <span>Loading attendance records...</span>
            </div>
          ) : records.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <DocumentChartBarIcon />
              </div>

              <strong>No attendance records</strong>

              <span>
                There are no detailed attendance records for this period.
              </span>
            </div>
          ) : (
            records.map((record, index) => {
              const recordId =
                record._id ||
                record.id ||
                `${record.employee?.id || 'employee'}-${index}`;

              const isOpen = expandedId === recordId;
              const status = getStatusMeta(record.status);

              return (
                <div
                  key={recordId}
                  style={{
                    ...styles.drawerRecord,
                    borderColor: isOpen
                      ? '#D9E3FB'
                      : COLORS.border,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isOpen ? null : recordId)
                    }
                    style={styles.drawerRecordHead}
                  >
                    <div style={styles.avatar}>
                      {getInitials(record.employee?.name)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.employeeName}>
                        {record.employee?.name || 'Unknown employee'}
                      </div>

                      <div style={styles.employeeMeta}>
                        {record.employee?.employeeCode ||
                          record.employee?.employee_code ||
                          '—'}

                        {record.employee?.department
                          ? ` · ${record.employee.department}`
                          : ''}

                        {record.date
                          ? ` · ${formatDate(record.date)}`
                          : ''}
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.statusBadge,
                        background: status.bg,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>

                    <ChevronDownIcon
                      style={{
                        width: 17,
                        height: 17,
                        color: COLORS.muted,
                        transform: isOpen
                          ? 'rotate(180deg)'
                          : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </button>

                  {isOpen && (
                    <div style={styles.drawerRecordBody}>
                      <div style={styles.drawerStats}>
                        <StatBox
                          label="Working hours"
                          value={formatHours(record.workingHours)}
                        />

                        <StatBox
                          label="Overtime"
                          value={formatHours(record.overtimeHours)}
                        />

                        <StatBox
                          label="Check-ins"
                          value={record.checkIns?.length || 0}
                        />

                        <StatBox
                          label="Check-outs"
                          value={record.checkOuts?.length || 0}
                        />
                      </div>

                      {record.checkIns?.length > 0 && (
                        <LogSection
                          title="Check-ins"
                          color={COLORS.green}
                          records={record.checkIns}
                          type="in"
                          onImageClick={setLightbox}
                        />
                      )}

                      {record.checkOuts?.length > 0 && (
                        <LogSection
                          title="Check-outs"
                          color={COLORS.red}
                          records={record.checkOuts}
                          type="out"
                          onImageClick={setLightbox}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div style={styles.drawerFooter}>
            <span style={styles.pageText}>
              Page {page} of {totalPages}
            </span>

            <div style={styles.pagination}>
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => fetchPage(page - 1)}
                style={styles.secondaryButton}
              >
                Previous
              </button>

              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => fetchPage(page + 1)}
                style={styles.primarySmallButton}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={styles.statBox}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

function LogSection({
  title,
  color,
  records,
  type,
  onImageClick,
}) {
  return (
    <div style={styles.logSection}>
      <div style={styles.logSectionTitle}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: color,
          }}
        />

        {title}
      </div>

      {records.map((item, index) => {
        const location = getLocationLabel(item.location);

        return (
          <div key={index} style={styles.logItem}>
            <div
              style={{
                ...styles.logIcon,
                background:
                  type === 'in'
                    ? COLORS.greenSoft
                    : COLORS.redSoft,
                color:
                  type === 'in'
                    ? COLORS.green
                    : COLORS.red,
              }}
            >
              <ClockIcon />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.logTime}>
                {formatTime(item.time)}

                {item.isLate && (
                  <span style={styles.lateBadge}>
                    +{item.lateByMinutes || 0}m late
                  </span>
                )}
              </div>

              {(item.branchName || location) && (
                <div style={styles.logLocation}>
                  <MapPinIcon />

                  <span>
                    {item.branchName || 'Branch'}
                    {location ? ` · ${location}` : ''}
                  </span>
                </div>
              )}
            </div>

            {item.selfie && (
              <img
                src={`${BASE_URL}/${String(item.selfie).replace(
                  /^\/+/,
                  ''
                )}`}
                alt={`${type} attendance selfie`}
                style={styles.smallSelfie}
                onClick={() =>
                  onImageClick(
                    `${BASE_URL}/${String(item.selfie).replace(
                      /^\/+/,
                      ''
                    )}`
                  )
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline Attendance Log                                                      */
/* -------------------------------------------------------------------------- */

function InlineAttendanceLog({ params }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  const LIMIT = 20;

  const fetchPage = async (pageNumber) => {
    setLoading(true);

    try {
      const response = await api.get('/attendance/all-detailed', {
        params: {
          month: params.month,
          year: params.year,
          page: pageNumber,
          limit: LIMIT,
        },
      });

      setRecords(response.data?.data || []);
      setTotal(Number(response.data?.total || 0));
      setPage(pageNumber);
    } catch {
      toast.error('Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
  }, [params.month, params.year]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <section style={styles.activitySection}>
      {lightbox && (
        <Lightbox
          src={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>
            Attendance activity
          </h2>

          <p style={styles.sectionSubtitle}>
            Review employee attendance events for the selected period.
          </p>
        </div>

        {total > 0 && (
          <span style={styles.recordCount}>
            {total.toLocaleString('en-IN')} records
          </span>
        )}
      </div>

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.tableLoading}>
            <Spinner />
            <span>Loading attendance activity...</span>
          </div>
        ) : records.length === 0 ? (
          <div style={styles.tableEmpty}>
            <DocumentChartBarIcon style={{ width: 30, height: 30 }} />

            <strong>No attendance records found</strong>

            <span>
              Try selecting another reporting period.
            </span>
          </div>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Check-in</th>
                  <th style={styles.th}>Check-out</th>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Selfies</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record, index) => {
                  const status = getStatusMeta(record.status);

                  const employeeCode =
                    record.employee?.employeeCode ||
                    record.employee?.employee_code ||
                    '—';

                  const allSelfies = [
                    ...(record.checkIns || [])
                      .filter((item) => item.selfie)
                      .map((item) => ({
                        src: `${BASE_URL}/${String(
                          item.selfie
                        ).replace(/^\/+/, '')}`,
                        type: 'in',
                      })),

                    ...(record.checkOuts || [])
                      .filter((item) => item.selfie)
                      .map((item) => ({
                        src: `${BASE_URL}/${String(
                          item.selfie
                        ).replace(/^\/+/, '')}`,
                        type: 'out',
                      })),
                  ];

                  const firstCheckIn =
                    record.checkIns?.[0];

                  const firstCheckOut =
                    record.checkOuts?.[0];

                  const location =
                    getLocationLabel(
                      firstCheckIn?.location ||
                        firstCheckOut?.location
                    );

                  return (
                    <tr
                      key={
                        record._id ||
                        record.id ||
                        `${record.employee?.id}-${index}`
                      }
                      style={styles.tableRow}
                    >
                      <td style={styles.td}>
                        <div style={styles.tableEmployee}>
                          <div style={styles.tableAvatar}>
                            {getInitials(
                              record.employee?.name
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={styles.tableEmployeeName}>
                              {record.employee?.name ||
                                'Unknown employee'}
                            </div>

                            <div style={styles.tableEmployeeMeta}>
                              {employeeCode}

                              {record.employee?.department
                                ? ` · ${record.employee.department}`
                                : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.dateText}>
                          {formatDate(record.date)}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: status.bg,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <AttendanceTimes
                          records={record.checkIns}
                          color={COLORS.green}
                          type="in"
                        />
                      </td>

                      <td style={styles.td}>
                        <AttendanceTimes
                          records={record.checkOuts}
                          color={COLORS.red}
                          type="out"
                        />
                      </td>

                      <td style={styles.td}>
                        {location ? (
                          <div style={styles.locationCell}>
                            <MapPinIcon />
                            <span title={location}>
                              {location}
                            </span>
                          </div>
                        ) : (
                          <span style={styles.mutedText}>
                            —
                          </span>
                        )}
                      </td>

                      <td style={styles.td}>
                        {allSelfies.length > 0 ? (
                          <div style={styles.selfieGroup}>
                            {allSelfies
                              .slice(0, 3)
                              .map((selfie, selfieIndex) => (
                                <img
                                  key={selfieIndex}
                                  src={selfie.src}
                                  alt={`${selfie.type} selfie`}
                                  title={`${selfie.type} selfie`}
                                  style={styles.tableSelfie}
                                  onClick={() =>
                                    setLightbox(selfie.src)
                                  }
                                />
                              ))}

                            {allSelfies.length > 3 && (
                              <span style={styles.moreSelfies}>
                                +{allSelfies.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={styles.mutedText}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && records.length > 0 && totalPages > 1 && (
        <div style={styles.paginationRow}>
          <span style={styles.pageText}>
            Page {page} of {totalPages}
          </span>

          <div style={styles.pagination}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => fetchPage(page - 1)}
              style={styles.secondaryButton}
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => fetchPage(page + 1)}
              style={styles.primarySmallButton}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AttendanceTimes({ records = [], color }) {
  if (!records.length) {
    return (
      <span style={styles.mutedText}>
        —
      </span>
    );
  }

  return (
    <div style={styles.timeList}>
      {records.slice(0, 2).map((item, index) => (
        <div key={index} style={styles.timeRow}>
          <span
            style={{
              ...styles.timeDot,
              background: color,
            }}
          />

          <span style={styles.timeValue}>
            {formatTime(item.time)}
          </span>

          {item.isLate && (
            <span style={styles.lateBadge}>
              +{item.lateByMinutes || 0}m
            </span>
          )}
        </div>
      ))}

      {records.length > 2 && (
        <span style={styles.additionalText}>
          +{records.length - 2} more
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report Card                                                                */
/* -------------------------------------------------------------------------- */

function ReportCard({
  icon: Icon,
  iconBackground,
  iconColor,
  title,
  description,
  meta,
  children,
}) {
  return (
    <article style={styles.reportCard}>
      <div style={styles.reportCardTop}>
        <div
          style={{
            ...styles.reportIcon,
            background: iconBackground,
            color: iconColor,
          }}
        >
          <Icon />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.reportTitle}>{title}</div>

          <p style={styles.reportDescription}>
            {description}
          </p>
        </div>
      </div>

      {meta && (
        <div style={styles.reportMeta}>
          <span style={styles.reportMetaDot} />
          {meta}
        </div>
      )}

      <div style={styles.reportActions}>
        {children}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Reports Page                                                               */
/* -------------------------------------------------------------------------- */

export default function ReportsPage() {
  const navigate = useNavigate();

  const [params, setParams] = useState({
    month: new Date().getMonth() + 1,
    year: CURRENT_YEAR,
  });

  const [downloading, setDownloading] = useState(null);
  const [showAttendanceDrawer, setShowAttendanceDrawer] =
    useState(false);
  const [showTimelineDrawer, setShowTimelineDrawer] =
    useState(false);

  const scopeLabel = new Date(
    params.year,
    params.month - 1
  ).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const downloadReport = async (type, format) => {
    const key = `${type}-${format}`;

    setDownloading(key);

    const toastId = toast.loading(
      `Generating ${type} ${format.toUpperCase()}...`
    );

    try {
      const url =
        `/reports/${type}/${format}` +
        `?month=${params.month}&year=${params.year}`;

      const response = await api.get(url, {
        responseType: 'blob',
      });

      const mimeType =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], {
        type: mimeType,
      });

      const downloadUrl =
        window.URL.createObjectURL(blob);

      const anchor = document.createElement('a');

      anchor.href = downloadUrl;

      anchor.download =
        `${type}_report_${params.year}_${params.month}.` +
        `${format === 'excel' ? 'xlsx' : 'pdf'}`;

      document.body.appendChild(anchor);

      anchor.click();

      document.body.removeChild(anchor);

      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Report downloaded successfully', {
        id: toastId,
      });
    } catch {
      toast.error(
        'Failed to generate the selected report',
        { id: toastId }
      );
    } finally {
      setDownloading(null);
    }
  };

  const reportCards = [
    {
      title: 'Detailed Attendance',
      description:
        'Review employee check-ins, check-outs, locations and attendance selfies.',
      meta: 'Live attendance records',
      icon: DocumentChartBarIcon,
      iconBackground: COLORS.blueSoft,
      iconColor: COLORS.blue,
    },
    {
      title: 'Workforce Attendance',
      description:
        'Export monthly attendance summaries including late marks, working hours and overtime.',
      meta: 'PDF and Excel available',
      icon: UserGroupIcon,
      iconBackground: COLORS.greenSoft,
      iconColor: COLORS.green,
    },
    {
      title: 'Payroll Report',
      description:
        'Export finalized payroll information including earnings, deductions and net salary.',
      meta: 'Finalized payroll records',
      icon: BanknotesIcon,
      iconBackground: COLORS.orangeSoft,
      iconColor: COLORS.orange,
    },
  ];

  return (
    <>
      <style>{`
        @keyframes reportsSpin {
          to { transform: rotate(360deg); }
        }

        .reports-page button,
        .reports-page select {
          font: inherit;
        }

        .reports-page button {
          -webkit-tap-highlight-color: transparent;
        }

        .reports-action:hover {
          transform: translateY(-1px);
        }

        .reports-action:active {
          transform: translateY(0);
        }

        .report-card:hover {
          border-color: #D8DDE5 !important;
          box-shadow: 0 8px 28px rgba(21,23,28,0.055) !important;
          transform: translateY(-2px);
        }

        .reports-table-row:hover {
          background: #FAFBFC;
        }

        .reports-select:focus {
          border-color: #9BB3EB !important;
          box-shadow: 0 0 0 3px rgba(53,103,214,0.08);
        }

        @media (max-width: 1100px) {
          .reports-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .reports-grid .report-card:last-child {
            grid-column: span 2;
          }
        }

        @media (max-width: 760px) {
          .reports-page {
            padding: 22px 16px 60px !important;
          }

          .reports-header-actions {
            width: 100%;
          }

          .reports-header-action {
            flex: 1;
          }

          .reports-grid {
            grid-template-columns: 1fr !important;
          }

          .reports-grid .report-card:last-child {
            grid-column: auto;
          }

          .reports-period {
            grid-template-columns: 1fr !important;
          }

          .reports-period-summary {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .reports-header-actions {
            display: grid !important;
            grid-template-columns: 1fr;
          }

          .reports-header-action {
            width: 100%;
          }

          .reports-title {
            font-size: 26px !important;
          }

          .reports-period-card {
            padding: 16px !important;
          }

          .reports-table {
            min-width: 980px;
          }
        }
      `}</style>

      <main
        className="reports-page"
        style={styles.page}
      >
        {/* Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>
              HR MANAGEMENT
              <span style={styles.breadcrumbSeparator}>/</span>
              REPORTS
            </div>

            <h1
              className="reports-title"
              style={styles.title}
            >
              Reports & Analytics
            </h1>

            <p style={styles.subtitle}>
              Generate, review and export workforce records
              for your organisation.
            </p>
          </div>

          <div
            className="reports-header-actions"
            style={styles.headerActions}
          >
            <button
              type="button"
              className="reports-action reports-header-action"
              onClick={() => navigate('/reports/calendar')}
              style={styles.secondaryAction}
            >
              <CalendarDaysIcon />
              Manage Attendance
              <ArrowRightIcon style={{ width: 15 }} />
            </button>

          <button
              type="button"
              className="reports-action reports-header-action"
              onClick={() => navigate('/attendance-ai')}
              style={styles.secondaryAction}
            >
              <CalendarDaysIcon />
              AI Analytics
              <ArrowRightIcon style={{ width: 15 }} />
            </button>

            <button
              type="button"
              className="reports-action reports-header-action"
              onClick={() => navigate('/holidays')}
              style={styles.secondaryAction}
            >
              <CalendarDaysIcon />
              Manage Holidays
              <ArrowRightIcon style={{ width: 15 }} />
            </button>

            <button
              type="button"
              className="reports-action reports-header-action"
              onClick={() =>
                setShowTimelineDrawer(true)
              }
              style={styles.primaryAction}
            >
              <MapPinIcon />
              Employee Timeline
            </button>
          </div>
        </header>

        {/* Period */}
        <section
          className="reports-period-card"
          style={styles.periodCard}
        >
          <div style={styles.periodHeading}>
            <div style={styles.periodIcon}>
              <CalendarDaysIcon />
            </div>

            <div>
              <div style={styles.cardEyebrow}>
                REPORTING PERIOD
              </div>

              <h2 style={styles.periodTitle}>
                Select the period for your reports
              </h2>
            </div>
          </div>

          <div
            className="reports-period"
            style={styles.periodGrid}
          >
            <div style={styles.field}>
              <label style={styles.fieldLabel}>
                Month
              </label>

              <select
                className="reports-select"
                value={params.month}
                onChange={(event) =>
                  setParams((current) => ({
                    ...current,
                    month: Number(event.target.value),
                  }))
                }
                style={styles.select}
              >
                {getMonthOptions().map((month) => (
                  <option
                    key={month.value}
                    value={month.value}
                  >
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.fieldLabel}>
                Year
              </label>

              <select
                className="reports-select"
                value={params.year}
                onChange={(event) =>
                  setParams((current) => ({
                    ...current,
                    year: Number(event.target.value),
                  }))
                }
                style={styles.select}
              >
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="reports-period-summary"
              style={styles.periodSummary}
            >
              <span style={styles.summaryLabel}>
                Current report period
              </span>

              <strong style={styles.summaryValue}>
                {scopeLabel}
              </strong>

              <span style={styles.summaryDescription}>
                All exports will use this reporting period.
              </span>
            </div>
          </div>
        </section>

        {/* Reports */}
        <section>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Available reports
              </h2>

              <p style={styles.sectionSubtitle}>
                Access operational and financial records
                for the selected period.
              </p>
            </div>
          </div>

          <div
            className="reports-grid"
            style={styles.reportGrid}
          >
            <div className="report-card">
              <ReportCard
                title={reportCards[0].title}
                description={reportCards[0].description}
                meta={reportCards[0].meta}
                icon={reportCards[0].icon}
                iconBackground={reportCards[0].iconBackground}
                iconColor={reportCards[0].iconColor}
              >
                <button
                  type="button"
                  className="reports-action"
                  onClick={() =>
                    setShowAttendanceDrawer(true)
                  }
                  style={styles.primaryReportButton}
                >
                  <DocumentChartBarIcon />
                  View attendance
                </button>
              </ReportCard>
            </div>

            <div className="report-card">
              <ReportCard
                title={reportCards[1].title}
                description={reportCards[1].description}
                meta={reportCards[1].meta}
                icon={reportCards[1].icon}
                iconBackground={reportCards[1].iconBackground}
                iconColor={reportCards[1].iconColor}
              >
                <button
                  type="button"
                  className="reports-action"
                  disabled={!!downloading}
                  onClick={() =>
                    downloadReport(
                      'attendance',
                      'pdf'
                    )
                  }
                  style={styles.outlineButton}
                >
                  <ArrowDownTrayIcon />
                  {downloading ===
                  'attendance-pdf'
                    ? 'Generating...'
                    : 'Export PDF'}
                </button>

                <button
                  type="button"
                  className="reports-action"
                  disabled={!!downloading}
                  onClick={() =>
                    downloadReport(
                      'attendance',
                      'excel'
                    )
                  }
                  style={styles.greenButton}
                >
                  <ArrowDownTrayIcon />
                  {downloading ===
                  'attendance-excel'
                    ? 'Generating...'
                    : 'Export Excel'}
                </button>
              </ReportCard>
            </div>

            <div className="report-card">
              <ReportCard
                title={reportCards[2].title}
                description={reportCards[2].description}
                meta={reportCards[2].meta}
                icon={reportCards[2].icon}
                iconBackground={reportCards[2].iconBackground}
                iconColor={reportCards[2].iconColor}
              >
                <button
                  type="button"
                  className="reports-action"
                  disabled={!!downloading}
                  onClick={() =>
                    downloadReport(
                      'payroll',
                      'pdf'
                    )
                  }
                  style={styles.outlineOrangeButton}
                >
                  <ArrowDownTrayIcon />
                  {downloading === 'payroll-pdf'
                    ? 'Generating...'
                    : 'Export payroll PDF'}
                </button>
              </ReportCard>
            </div>
          </div>
        </section>

        {/* Information */}
        <div style={styles.infoBanner}>
          <div style={styles.infoIcon}>
            <InformationCircleIcon />
          </div>

          <div>
            <strong style={styles.infoTitle}>
              Reporting information
            </strong>

            <p style={styles.infoText}>
              Attendance logs include cross-branch
              attendance activity. Payroll exports
              contain finalized payroll records only.
            </p>
          </div>
        </div>

        {/* Attendance Activity */}
        <InlineAttendanceLog params={params} />
      </main>

      {showAttendanceDrawer && (
        <AttendanceDrawer
          params={params}
          onClose={() =>
            setShowAttendanceDrawer(false)
          }
        />
      )}

      {showTimelineDrawer && (
        <EmployeeTimelineDrawer
          onClose={() =>
            setShowTimelineDrawer(false)
          }
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = {
  page: {
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    padding: '30px 28px 80px',
    fontFamily:
      'Inter, DM Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxSizing: 'border-box',
  },

  header: {
    maxWidth: 1440,
    margin: '0 auto 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 24,
    flexWrap: 'wrap',
  },

  breadcrumb: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.11em',
    color: COLORS.muted,
    marginBottom: 8,
  },

  breadcrumbSeparator: {
    margin: '0 7px',
    color: '#C5C8CE',
  },

  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.15,
    fontWeight: 750,
    letterSpacing: '-0.035em',
    color: COLORS.text,
  },

  subtitle: {
    margin: '8px 0 0',
    fontSize: 14,
    lineHeight: 1.6,
    color: COLORS.secondary,
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    flexWrap: 'wrap',
  },

  primaryAction: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 15px',
    borderRadius: 9,
    border: `1px solid ${COLORS.blue}`,
    background: COLORS.blue,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 650,
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(53,103,214,0.16)',
    transition: 'all .18s ease',
  },

  secondaryAction: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '10px 13px',
    borderRadius: 9,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .18s ease',
  },

  periodCard: {
    maxWidth: 1440,
    margin: '0 auto 32px',
    padding: 22,
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    boxShadow: '0 2px 8px rgba(21,23,28,0.025)',
  },

  periodHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },

  periodIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: COLORS.blueSoft,
    color: COLORS.blue,
    flexShrink: 0,
  },

  cardEyebrow: {
    fontSize: 9,
    fontWeight: 750,
    letterSpacing: '0.1em',
    color: COLORS.muted,
    marginBottom: 3,
  },

  periodTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.text,
    letterSpacing: '-0.01em',
  },

  periodGrid: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(160px, 220px) minmax(120px, 170px) minmax(260px, 1fr)',
    gap: 14,
    alignItems: 'end',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },

  fieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },

  select: {
    width: '100%',
    height: 42,
    padding: '0 13px',
    borderRadius: 9,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surfaceAlt,
    color: COLORS.text,
    outline: 'none',
    fontSize: 13,
    fontWeight: 550,
    cursor: 'pointer',
  },

  periodSummary: {
    minHeight: 42,
    padding: '9px 14px',
    borderRadius: 9,
    background: COLORS.blueSoft,
    border: '1px solid #DCE7FF',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },

  summaryLabel: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#7086B6',
  },

  summaryValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.blue,
  },

  summaryDescription: {
    marginTop: 1,
    fontSize: 10,
    color: '#7890C0',
  },

  sectionHeader: {
    maxWidth: 1440,
    margin: '0 auto 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 15,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 720,
    color: COLORS.text,
    letterSpacing: '-0.02em',
  },

  sectionSubtitle: {
    margin: '5px 0 0',
    fontSize: 12,
    color: COLORS.secondary,
  },

  reportGrid: {
    maxWidth: 1440,
    margin: '0 auto 20px',
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(0, 1fr))',
    gap: 15,
  },

  reportCard: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 20,
    minHeight: 225,
    display: 'flex',
    flexDirection: 'column',
    transition:
      'border-color .18s ease, box-shadow .18s ease, transform .18s ease',
    boxShadow: '0 2px 8px rgba(21,23,28,0.025)',
  },

  reportCardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 13,
  },

  reportIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  reportTitle: {
    fontSize: 15,
    fontWeight: 720,
    color: COLORS.text,
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },

  reportDescription: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: COLORS.secondary,
  },

  reportMeta: {
    marginTop: 17,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.muted,
  },

  reportMetaDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#B8BDC6',
  },

  reportActions: {
    marginTop: 'auto',
    paddingTop: 20,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },

  primaryReportButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 37,
    padding: '0 13px',
    borderRadius: 8,
    border: `1px solid ${COLORS.blue}`,
    background: COLORS.blue,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 650,
    cursor: 'pointer',
    transition: 'all .18s ease',
  },

  outlineButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 37,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid #C8D2EA`,
    background: COLORS.surface,
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: 650,
    cursor: 'pointer',
  },

  greenButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 37,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid #B8E0CE`,
    background: COLORS.greenSoft,
    color: COLORS.green,
    fontSize: 11,
    fontWeight: 650,
    cursor: 'pointer',
  },

  outlineOrangeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 37,
    padding: '0 13px',
    borderRadius: 8,
    border: `1px solid #E7CFAC`,
    background: COLORS.orangeSoft,
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: 650,
    cursor: 'pointer',
  },

  infoBanner: {
    maxWidth: 1440,
    margin: '0 auto 30px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 11,
    padding: '13px 15px',
    background: '#F8FAFF',
    border: '1px solid #DDE6F8',
    borderRadius: 11,
  },

  infoIcon: {
    width: 18,
    height: 18,
    color: COLORS.blue,
    flexShrink: 0,
  },

  infoTitle: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 2,
  },

  infoText: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.5,
    color: COLORS.secondary,
  },

  activitySection: {
    maxWidth: 1440,
    margin: '0 auto',
  },

  recordCount: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: 20,
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    fontSize: 11,
    fontWeight: 600,
    color: COLORS.secondary,
  },

  tableCard: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(21,23,28,0.025)',
  },

  tableScroll: {
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 980,
  },

  th: {
    padding: '11px 15px',
    background: COLORS.surfaceAlt,
    borderBottom: `1px solid ${COLORS.border}`,
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: 750,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '12px 15px',
    borderBottom: `1px solid #EFF0F2`,
    verticalAlign: 'middle',
    fontSize: 12,
    color: COLORS.secondary,
  },

  tableRow: {
    transition: 'background .12s ease',
  },

  tableEmployee: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 190,
  },

  tableAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: COLORS.blueSoft,
    border: '1px solid #D9E4FD',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: 750,
    flexShrink: 0,
  },

  tableEmployeeName: {
    fontSize: 12,
    fontWeight: 650,
    color: COLORS.text,
    whiteSpace: 'nowrap',
  },

  tableEmployeeMeta: {
    marginTop: 2,
    fontSize: 10,
    color: COLORS.muted,
    whiteSpace: 'nowrap',
  },

  dateText: {
    whiteSpace: 'nowrap',
    color: COLORS.secondary,
    fontSize: 11,
  },

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  timeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },

  timeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },

  timeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },

  timeValue: {
    fontSize: 11,
    fontWeight: 600,
    color: COLORS.text,
  },

  lateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 6px',
    borderRadius: 12,
    background: COLORS.orangeSoft,
    color: COLORS.orange,
    fontSize: 9,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  additionalText: {
    fontSize: 9,
    color: COLORS.muted,
    marginLeft: 12,
  },

  locationCell: {
    maxWidth: 190,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: COLORS.secondary,
    fontSize: 10,
  },

  mutedText: {
    color: COLORS.muted,
    fontSize: 12,
  },

  selfieGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },

  tableSelfie: {
    width: 36,
    height: 36,
    objectFit: 'cover',
    borderRadius: 7,
    border: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
  },

  moreSelfies: {
    width: 30,
    height: 30,
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: COLORS.surfaceAlt,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.secondary,
    fontSize: 9,
    fontWeight: 700,
  },

  tableLoading: {
    minHeight: 220,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    color: COLORS.secondary,
    fontSize: 12,
  },

  tableEmpty: {
    minHeight: 220,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    color: COLORS.muted,
    fontSize: 12,
  },

  paginationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 13,
  },

  pageText: {
    fontSize: 11,
    color: COLORS.muted,
  },

  pagination: {
    display: 'flex',
    gap: 7,
  },

  secondaryButton: {
    height: 34,
    padding: '0 12px',
    borderRadius: 7,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },

  primarySmallButton: {
    height: 34,
    padding: '0 13px',
    borderRadius: 7,
    border: `1px solid ${COLORS.blue}`,
    background: COLORS.blue,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },

  /* Drawer */

  drawerOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(15,23,42,0.28)',
    backdropFilter: 'blur(2px)',
  },

  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(600px, 100vw)',
    zIndex: 101,
    background: COLORS.surface,
    borderLeft: `1px solid ${COLORS.border}`,
    boxShadow: '-18px 0 50px rgba(15,23,42,0.12)',
    display: 'flex',
    flexDirection: 'column',
  },

  drawerHeader: {
    padding: '20px 22px',
    borderBottom: `1px solid ${COLORS.border}`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 15,
  },

  drawerEyebrow: {
    fontSize: 9,
    fontWeight: 750,
    color: COLORS.blue,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  drawerTitle: {
    margin: 0,
    fontSize: 19,
    fontWeight: 750,
    color: COLORS.text,
    letterSpacing: '-0.025em',
  },

  drawerSubtitle: {
    margin: '4px 0 0',
    fontSize: 11,
    color: COLORS.secondary,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surfaceAlt,
    color: COLORS.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },

  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
  },

  centerState: {
    minHeight: 220,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    color: COLORS.secondary,
    fontSize: 12,
  },

  emptyState: {
    minHeight: 260,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    textAlign: 'center',
    color: COLORS.secondary,
    fontSize: 12,
  },

  emptyIcon: {
    width: 44,
    height: 44,
    marginBottom: 4,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: COLORS.blueSoft,
    color: COLORS.blue,
  },

  drawerRecord: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 11,
    marginBottom: 9,
    overflow: 'hidden',
    background: COLORS.surface,
    transition: 'border-color .15s ease',
  },

  drawerRecordHead: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    border: 0,
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: COLORS.blueSoft,
    border: '1px solid #D9E4FD',
    color: COLORS.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 750,
    flexShrink: 0,
  },

  employeeName: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.text,
  },

  employeeMeta: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.muted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  drawerRecordBody: {
    padding: '0 13px 14px',
    borderTop: `1px solid ${COLORS.border}`,
  },

  drawerStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 7,
    marginTop: 12,
  },

  statBox: {
    padding: '9px 10px',
    background: COLORS.surfaceAlt,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
  },

  statLabel: {
    display: 'block',
    fontSize: 8,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
  },

  statValue: {
    display: 'block',
    marginTop: 3,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: 700,
  },

  logSection: {
    marginTop: 16,
  },

  logSectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 9,
    fontWeight: 750,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 7,
  },

  logItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '9px 0',
    borderBottom: `1px solid #F0F1F3`,
  },

  logIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  logTime: {
    fontSize: 12,
    fontWeight: 650,
    color: COLORS.text,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },

  logLocation: {
    marginTop: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: COLORS.muted,
    fontSize: 9,
    lineHeight: 1.4,
  },

  smallSelfie: {
    width: 42,
    height: 42,
    borderRadius: 8,
    objectFit: 'cover',
    border: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
    flexShrink: 0,
  },

  drawerFooter: {
    padding: '13px 18px',
    borderTop: `1px solid ${COLORS.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },

  /* Lightbox */

  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
    background: 'rgba(15,23,42,0.82)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  lightboxImage: {
    maxWidth: '90vw',
    maxHeight: '86vh',
    objectFit: 'contain',
    borderRadius: 12,
    boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
  },

  lightboxClose: {
    position: 'fixed',
    top: 20,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.10)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};

