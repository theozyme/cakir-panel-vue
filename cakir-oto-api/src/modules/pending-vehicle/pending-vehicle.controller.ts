import type { NextFunction, Request, Response } from "express";

import { asRecord } from "../../lib/validation.js";
import {
  createPendingVehicle,
  getPendingVehicle,
  listPendingVehicles,
} from "./pending-vehicle.service.js";

export const getPendingVehicles = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listPendingVehicles());
  } catch (error) {
    next(error);
  }
};

export const getPendingVehicleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await getPendingVehicle(req.params.id ?? ""));
  } catch (error) {
    next(error);
  }
};

export const postPendingVehicle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    res.status(201).json(await createPendingVehicle(body.plate));
  } catch (error) {
    next(error);
  }
};
