import { Router } from "express";
import { deleteNote, getNotes, patchNote, postNote } from "./supplier-note.controller.js";

import {
  getSummary,
  getExport,
  getSuppliers,
  getTransactions,
  getTrend,
  postDebt,
  postPayment,
  postSupplier,
  patchSupplierStatus,
  undoTransaction,
} from "./supplier.controller.js";

export const supplierRouter = Router();

supplierRouter.get("/summary", getSummary);
supplierRouter.get("/trend", getTrend);
supplierRouter.get("/export", getExport);
supplierRouter.get("/", getSuppliers);
supplierRouter.post("/", postSupplier);
supplierRouter.patch("/:supplierId/status", patchSupplierStatus);
supplierRouter.get("/:supplierId/transactions", getTransactions);
supplierRouter.patch("/:supplierId/transactions/:transactionId/undo", undoTransaction);
supplierRouter.post("/:supplierId/payments", postPayment);
supplierRouter.post("/:supplierId/debts", postDebt);
supplierRouter.get("/:supplierId/notes", getNotes);
supplierRouter.post("/:supplierId/notes", postNote);
supplierRouter.patch("/:supplierId/notes/:noteId", patchNote);
supplierRouter.delete("/:supplierId/notes/:noteId", deleteNote);
