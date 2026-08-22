import type { NextFunction, Request, Response } from "express";

import {
  createSpecialPayment,
  deleteSpecialPayment,
  getSpecialPaymentSummary,
  listActiveInvoiceTypes,
  listSpecialPayments,
  parseSpecialPaymentCategory,
  parseSpecialPaymentInput,
  parseSpecialPaymentPeriodFilter,
} from "./special-payment.service.js";

const param = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getSpecialPaymentSummary(parseSpecialPaymentPeriodFilter(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(
      await listSpecialPayments(
        parseSpecialPaymentCategory(req.query.category),
        parseSpecialPaymentPeriodFilter(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getInvoiceTypes = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listActiveInvoiceTypes());
  } catch (error) {
    next(error);
  }
};

export const postPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res
      .status(201)
      .json(
        await createSpecialPayment(
          parseSpecialPaymentCategory(param(req.params.category)),
          parseSpecialPaymentInput(req.body),
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const removePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(
      await deleteSpecialPayment(
        parseSpecialPaymentCategory(param(req.params.category)),
        param(req.params.paymentId),
      ),
    );
  } catch (error) {
    next(error);
  }
};
