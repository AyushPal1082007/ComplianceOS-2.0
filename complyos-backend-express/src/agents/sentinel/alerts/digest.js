export function digestAlerts(alerts = []) {
  return alerts.map((alert) => ({
    userId: alert.userId,
    title: alert.title,
    summary: alert.summary,
  }));
}

export default { digestAlerts };
