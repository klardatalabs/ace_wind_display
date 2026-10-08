import { Router } from "express";
import { getState } from "../services/turbineState.js";

const router = Router();

router.get("/", (_req, res) => res.json(getState()));

export default router;
