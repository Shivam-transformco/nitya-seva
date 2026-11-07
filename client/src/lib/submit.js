import config from "../config";
import { formatINR } from "../content";
import { API_BASE } from "./apiBase";

export const whatsappLink = (text) =>
  `https://wa.me/${config.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function whatsappMessage(d) {
  return [
    "Hare Krishna! I would like to become a Nitya Sevak at ISKCON BACE Jiasarai.",
    `Name: ${d.name}`,
    `Phone: ${d.phone}`,
    d.email && `Email: ${d.email}`,
    `Monthly offering: ${formatINR(d.amount)}`,
    d.message && `Message: ${d.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function submitSeva(d) {
  const res = await fetch(`${API_BASE}/api/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...d, submittedFrom: window.location.href }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || "Submission failed");
}
