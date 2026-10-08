// Lets Ace put pictures in front of the visitor: a strip of Unsplash photos above its reply.

import { searchPhotos, trackDownload, isPhotoSearchEnabled } from "../../services/photoService.js";

export const definition = {
  type: "function",
  function: {
    name: "show_photos",
    description:
      "Show the visitor a few photographs (from Unsplash) above your reply. Use it when seeing something would help: what a wind turbine blade, nacelle or offshore wind farm looks like, the Severn Estuary, a place, a bird, a kind of weather. Use a specific, visual English query like 'wind turbine blade close up' or 'Severn Estuary sunset'. Do not use it for questions about live data. After calling it, mention the pictures in a few words.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "A visual search query for photographs" },
        count: { type: "integer", minimum: 1, maximum: 4, description: "How many photos (default 4)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export const isEnabled = isPhotoSearchEnabled;

export async function run({ query = "", count = 4 } = {}, ctx = {}) {
  try {
    const photos = await searchPhotos(query, { count: Math.min(4, Number(count) || 4) });
    if (!photos.length) return { shown: 0, note: "No suitable photos were found; just answer in words." };
    trackDownload(photos);
    ctx.onPhotos?.(photos);
    return { shown: photos.length, note: "The photos are now displayed above your reply. Refer to them briefly; do not describe them in detail or list links." };
  } catch (err) {
    return { shown: 0, error: `Photos unavailable: ${err.message}. Answer in words.` };
  }
}
