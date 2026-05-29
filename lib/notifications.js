export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function showOverdueNotification(count) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification("FA CRM — Follow-ups Due", {
    body: `You have ${count} client${count !== 1 ? "s" : ""} due for follow-up.`,
  });
}
