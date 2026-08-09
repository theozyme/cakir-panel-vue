import { Router } from "express";

import {
  confirmPendingVehicleController,
  getPendingVehicles,
  postPendingVehicle,
} from "./pending-vehicle.controller.js";

export const pendingVehicleRouter = Router();

pendingVehicleRouter.get("/", getPendingVehicles);
pendingVehicleRouter.post("/", postPendingVehicle);
pendingVehicleRouter.post("/:id/confirm", confirmPendingVehicleController);
