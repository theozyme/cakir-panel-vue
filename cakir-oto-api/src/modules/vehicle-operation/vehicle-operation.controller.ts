import type { NextFunction, Request, Response } from "express";

import {
  createVehicleOperation,
  listDailyVehicleOperations,
  listVehicleOperationHistory,
} from "./vehicle-operation.service.js";

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
    res.json(
      await listVehicleOperationHistory({
        search: req.query.search,
        page: req.query.page,
        pageSize: req.query.pageSize,
      }),
    );
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
