import { Router } from "express";

import {
  getSummary,
  getSuppliers,
  getTransactions,
  getTrend,
  postDebt,
  postPayment,
} from "./supplier.controller.js";

export const supplierRouter = Router();

supplierRouter.get("/summary", getSummary);
supplierRouter.get("/trend", getTrend);
supplierRouter.get("/", getSuppliers);
supplierRouter.get("/:supplierId/transactions", getTransactions);
supplierRouter.post("/:supplierId/payments", postPayment);
supplierRouter.post("/:supplierId/debts", postDebt);
