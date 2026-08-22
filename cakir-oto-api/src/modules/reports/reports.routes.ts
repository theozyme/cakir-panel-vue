import { Router } from "express";

import { getOverview } from "./reports.controller.js";

export const reportsRouter = Router();

reportsRouter.get("/overview", getOverview);
