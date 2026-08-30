import { Router } from "express";

import { getDashboard, getOverview } from "./reports.controller.js";

export const reportsRouter = Router();

reportsRouter.get("/dashboard", getDashboard);
reportsRouter.get("/overview", getOverview);
