export function trackEvent(name: string, context?: Record<string, unknown>) {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, context }),
  }).catch(() => {});
}
