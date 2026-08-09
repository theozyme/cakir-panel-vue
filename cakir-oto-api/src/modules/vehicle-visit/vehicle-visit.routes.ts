import { Router } from "express";

import { getVehicleVisit } from "./vehicle-visit.controller.js";

export const vehicleVisitRouter = Router();

vehicleVisitRouter.get("/:visitId", getVehicleVisit);
