import { Router } from "express";

import {
  getInvoiceTypes,
  getPayments,
  getSummary,
  postPayment,
  removePayment,
} from "./special-payment.controller.js";

export const specialPaymentRouter = Router();

specialPaymentRouter.get("/summary", getSummary);
specialPaymentRouter.get("/invoice-types", getInvoiceTypes);
specialPaymentRouter.get("/", getPayments);
specialPaymentRouter.post("/:category", postPayment);
specialPaymentRouter.delete("/:category/:paymentId", removePayment);
