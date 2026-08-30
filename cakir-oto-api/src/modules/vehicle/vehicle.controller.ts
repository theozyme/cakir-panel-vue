import type { NextFunction, Request, Response } from "express";

import { getVehicleHistory, getVehicleIntakeContext, listVehicles } from "./vehicle.service.js";

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

export const getVehicleIntakeContextController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await getVehicleIntakeContext(req.params.vehicleId ?? ""));
  } catch (error) {
    next(error);
  }
};
