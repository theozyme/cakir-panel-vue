import type { NextFunction, Request, Response } from "express";

import {
  createVehicleOperation,
  deleteVehicleOperation,
  getVehicleOperationDetail,
  listDailyVehicleOperations,
  updateVehicleOperation,
} from "./vehicle-operation.service.js";
import {
  listVehicleOperationHistory,
  listVehicleHistoryFilterOptions,
} from "./vehicle-history.service.js";

export const getVehicleOperations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listDailyVehicleOperations(req.query.date));
  } catch (error) {
    next(error);
  }
};

export const getVehicleOperationHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await listVehicleOperationHistory(req.query));
  } catch (error) {
    next(error);
  }
};

export const getVehicleHistoryFilterOptions = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await listVehicleHistoryFilterOptions());
  } catch (error) {
    next(error);
  }
};

export const postVehicleOperation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createVehicleOperation(req.body));
  } catch (error) {
    next(error);
  }
};

export const getVehicleOperation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getVehicleOperationDetail(req.params.id ?? ""));
  } catch (error) {
    next(error);
  }
};

export const patchVehicleOperation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateVehicleOperation(req.params.id ?? "", req.body));
  } catch (error) {
    next(error);
  }
};

export const deleteVehicleOperationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await deleteVehicleOperation(req.params.id ?? "", req.body));
  } catch (error) {
    next(error);
  }
};
