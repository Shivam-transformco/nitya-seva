import config from "../config";
import { formatINR } from "../content";

export const whatsappLink = (text) =>
  `https://wa.me/${config.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function whatsappMessage(d) {
  return [
    "Hare Krishna! I would like to become a Nitya Sevak at ISKCON Jiasarai.",
    `Name: ${d.name}`,
    `Phone: ${d.phone}`,
    d.email && `Email: ${d.email}`,
    d.city && `City: ${d.city}`,
    `Offering: ${formatINR(d.amount)} (${d.frequency})`,
    d.purposes && `For: ${d.purposes}`,
    d.occasion && `Occasion: ${d.occasion}`,
    `Best time to call: ${d.contactTime}`,
    d.message && `Message: ${d.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function submitSeva(d) {
  if (!config.formEndpoint) {
    window.open(whatsappLink(whatsappMessage(d)), "_blank", "noopener");
    return;
  }
  // Apps Script web apps don't send CORS headers, so the response is opaque.
  await fetch(config.formEndpoint, {
    method: "POST",
    mode: "no-cors",
    body: new URLSearchParams({ ...d, submittedFrom: window.location.href }),
  });
}
