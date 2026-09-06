import type { NextFunction, Request, Response } from "express";

import { asRecord } from "../../lib/validation.js";
import {
  createPendingVehicle,
  cancelPendingVehicle,
  getPendingVehicle,
  listPendingVehicles,
} from "./pending-vehicle.service.js";

export const deletePendingVehicle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cancelPendingVehicle(req.params.id ?? "");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

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
