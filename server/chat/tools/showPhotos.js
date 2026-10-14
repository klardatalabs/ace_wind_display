// Puts photographs in front of the visitor (Unsplash), shown above the answer.

import { searchPhotos, trackPhotosShown, photosEnabled } from "../../integrations/unsplash.js";

export const kind = "photo_search";
export const isEnabled = photosEnabled;

export const definition = {
  type: "function",
  function: {
    name: "show_photos",
    description: "Show the visitor a few photographs above your answer, when seeing something helps: a blade, a nacelle, an offshore wind farm, the Severn Estuary, a kind of weather. Use a specific visual query in English, e.g. 'wind turbine blade close up'. After calling it, mention the pictures in a few words.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "A visual search query" },
        count: { type: "integer", minimum: 1, maximum: 4 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export async function run({ query = "", count = 3 } = {}, ctx) {
  const photos = await searchPhotos(query, { count: Math.min(4, Number(count) || 3) });
  if (!photos.length) return { shown: 0, note: "No suitable photos; answer in words." };
  trackPhotosShown(photos);
  ctx.addPhotos(photos);
  return { shown: photos.length, note: "The photos are displayed above your answer. Refer to them briefly." };
}
