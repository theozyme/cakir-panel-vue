import { Router } from "express";

import {
  getVehicleOperationHistory,
  getVehicleOperations,
  postVehicleOperation,
} from "./vehicle-operation.controller.js";

export const vehicleOperationRouter = Router();

vehicleOperationRouter.get("/history", getVehicleOperationHistory);
vehicleOperationRouter.get("/", getVehicleOperations);
vehicleOperationRouter.post("/", postVehicleOperation);
