import { Router } from "express";

import {
  getVehicleHistoryController,
  getVehicleIntakeContextController,
  getVehicles,
} from "./vehicle.controller.js";

export const vehicleRouter = Router();

vehicleRouter.get("/", getVehicles);
vehicleRouter.get("/:vehicleId/intake-context", getVehicleIntakeContextController);
vehicleRouter.get("/:vehicleId/history", getVehicleHistoryController);
