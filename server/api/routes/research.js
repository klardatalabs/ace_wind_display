import { Router } from "express";
import { listDocuments } from "../../db/repositories/knowledge.js";
import { buildLibrary } from "../../knowledge/library.js";

export const researchRoutes = Router();

researchRoutes.get("/library", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300").json(buildLibrary(await listDocuments()));
  } catch {
    // The public reading list remains available while the knowledge database is down.
    res.set("Cache-Control", "no-store").json(buildLibrary([], "unavailable"));
  }
});
