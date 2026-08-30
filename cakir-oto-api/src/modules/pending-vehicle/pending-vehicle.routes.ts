import { Router } from "express";

import {
  getPendingVehicleController,
  getPendingVehicles,
  postPendingVehicle,
} from "./pending-vehicle.controller.js";

export const pendingVehicleRouter = Router();

pendingVehicleRouter.get("/", getPendingVehicles);
pendingVehicleRouter.get("/:id", getPendingVehicleController);
pendingVehicleRouter.post("/", postPendingVehicle);
