import type { NextFunction, Request, Response } from "express";

import { getReportsOverview, parseReportPeriodFilter } from "./reports.service.js";

export const getOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getReportsOverview(parseReportPeriodFilter(req.query)));
  } catch (error) {
    next(error);
  }
};
