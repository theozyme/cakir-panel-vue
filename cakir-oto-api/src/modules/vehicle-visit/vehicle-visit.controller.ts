import type { NextFunction, Request, Response } from "express";

import { getVehicleVisitDetail } from "./vehicle-visit.service.js";

export const getVehicleVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getVehicleVisitDetail(req.params.visitId ?? ""));
  } catch (error) {
    next(error);
  }
};
