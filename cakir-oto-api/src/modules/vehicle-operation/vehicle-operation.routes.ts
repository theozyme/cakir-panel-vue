import { Router } from "express";

import {
  deleteVehicleOperationController,
  getVehicleOperation,
  getVehicleOperationHistory,
  getVehicleOperations,
  patchVehicleOperation,
  postVehicleOperation,
} from "./vehicle-operation.controller.js";

export const vehicleOperationRouter = Router();

vehicleOperationRouter.get("/history", getVehicleOperationHistory);
vehicleOperationRouter.get("/", getVehicleOperations);
vehicleOperationRouter.post("/", postVehicleOperation);
vehicleOperationRouter.get("/:id", getVehicleOperation);
vehicleOperationRouter.patch("/:id", patchVehicleOperation);
vehicleOperationRouter.delete("/:id", deleteVehicleOperationController);
