import type { NextFunction, Request, Response } from "express";

import { createVisitForVehicle } from "../vehicle-visit/vehicle-visit.service.js";
import { getVehicleHistory, listVehicles } from "./vehicle.service.js";

export const getVehicles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listVehicles(req.query.search, req.query.limit));
  } catch (error) {
    next(error);
  }
};

export const getVehicleHistoryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vehicleId = req.params.vehicleId;
    res.json(await getVehicleHistory(typeof vehicleId === "string" ? vehicleId : ""));
  } catch (error) {
    next(error);
  }
};

export const postVehicleVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vehicleId = req.params.vehicleId;
    res
      .status(201)
      .json(await createVisitForVehicle(typeof vehicleId === "string" ? vehicleId : ""));
  } catch (error) {
    next(error);
  }
};
