import { format, parseISO, differenceInMinutes } from 'date-fns';

/**
 * Format date string to display format
 */
export const formatDate = (date, pattern = 'dd MMM yyyy') => {
  if (!date) return '—';
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, pattern);
  } catch {
    return '—';
  }
};

/**
 * Format time from ISO string
 */
export const formatTime = (date, pattern = 'hh:mm a') => {
  if (!date) return '—';
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, pattern);
  } catch {
    return '—';
  }
};

/**
 * Format number as Indian Rupee
 */
export const formatINR = (amount) => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Get badge color classes based on status string
 */
export const getStatusBadge = (status) => {
  const map = {
    present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    'half-day': 'bg-yellow-100 text-yellow-700',
    'on-leave': 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
    draft: 'bg-gray-100 text-gray-600',
    processed: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-red-100 text-red-700',
  };
  return map[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';
};

/**
 * Get month options for selects
 */
export const getMonthOptions = () =>
  Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
  }));

/**
 * Truncate a string to a max length with ellipsis
 */
export const truncate = (str, max = 30) => {
  if (!str) return '';
  return str.length > max ? `${str.substring(0, max)}...` : str;
};

/**
 * Calculate working hours between two timestamps as a formatted string
 */
export const calcWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return '—';
  const mins = differenceInMinutes(new Date(checkOut), new Date(checkIn));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};