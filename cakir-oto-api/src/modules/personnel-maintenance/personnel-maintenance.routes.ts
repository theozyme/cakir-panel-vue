import { Router } from "express";

import {
  getPersonnel,
  patchPersonnel,
  postPersonnel,
} from "./personnel-maintenance.controller.js";

export const personnelMaintenanceRouter = Router();

personnelMaintenanceRouter.get("/", getPersonnel);
personnelMaintenanceRouter.post("/", postPersonnel);
personnelMaintenanceRouter.patch("/:id", patchPersonnel);
