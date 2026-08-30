import type { NextFunction, Request, Response } from "express";

import {
  getDashboardFinance,
  getReportsOverview,
  parseDashboardFinanceFilter,
  parseReportPeriodFilter,
} from "./reports.service.js";

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getDashboardFinance(parseDashboardFinanceFilter(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getReportsOverview(parseReportPeriodFilter(req.query)));
  } catch (error) {
    next(error);
  }
};
