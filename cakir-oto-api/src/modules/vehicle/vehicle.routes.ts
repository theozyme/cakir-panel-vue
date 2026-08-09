import { Router } from "express";

import {
  getVehicleHistoryController,
  getVehicles,
  postVehicleVisit,
} from "./vehicle.controller.js";

export const vehicleRouter = Router();

vehicleRouter.get("/", getVehicles);
vehicleRouter.get("/:vehicleId/history", getVehicleHistoryController);
vehicleRouter.post("/:vehicleId/visits", postVehicleVisit);
