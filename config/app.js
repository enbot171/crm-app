export const CLIENT_STATUSES = ["Prospect", "Warm Lead", "Strong Client", "Client"];

export const CONTACT_TYPES = ["Telegram", "Email", "Instagram"];

export const USER_ROLES = ["User", "Admin"];

export const DEFAULT_FOLLOW_UP_DAYS = 7;
export const DEFAULT_INACTIVITY_DAYS = 30;

const STYLE_PALETTE = [
  "bg-gray-100 text-gray-700",
  "bg-gray-200 text-gray-800",
  "bg-gray-400 text-white",
  "bg-gray-600 text-white",
  "bg-gray-800 text-white",
  "bg-black text-white",
];

const COLOR_PALETTE = [
  "bg-gray-200",
  "bg-gray-300",
  "bg-gray-400",
  "bg-gray-500",
  "bg-gray-700",
  "bg-black",
];

export function getStatusStyle(statuses, status) {
  const idx = statuses.indexOf(status);
  if (idx === -1) return "bg-gray-100 text-gray-700";
  const n = statuses.length;
  const pos = n === 1 ? STYLE_PALETTE.length - 1 : Math.round((idx / (n - 1)) * (STYLE_PALETTE.length - 1));
  return STYLE_PALETTE[pos];
}

export function getStatusColor(statuses, status) {
  const idx = statuses.indexOf(status);
  if (idx === -1) return "bg-gray-300";
  const n = statuses.length;
  const pos = n === 1 ? COLOR_PALETTE.length - 1 : Math.round((idx / (n - 1)) * (COLOR_PALETTE.length - 1));
  return COLOR_PALETTE[pos];
}
