import { Router } from "express";

import {
  getLoanAccounts,
  patchLoanAccount,
  postLoanAccount,
} from "./loan-account-maintenance.controller.js";

export const loanAccountMaintenanceRouter = Router();

loanAccountMaintenanceRouter.get("/", getLoanAccounts);
loanAccountMaintenanceRouter.post("/", postLoanAccount);
loanAccountMaintenanceRouter.patch("/:id", patchLoanAccount);
