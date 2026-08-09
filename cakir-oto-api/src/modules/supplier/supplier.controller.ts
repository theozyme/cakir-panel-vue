import type { NextFunction, Request, Response } from "express";

import {
  createManualSupplierTransaction,
  getSupplierSummary,
  getSupplierTrend,
  listActiveSuppliers,
  listSupplierTransactions,
  parseManualSupplierTransaction,
  parseSupplierPeriodFilter,
} from "./supplier.service.js";

const supplierIdFrom = (req: Request): string => {
  const value = req.params.supplierId;
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
};

export const getSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listActiveSuppliers(parseSupplierPeriodFilter(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getSupplierSummary(parseSupplierPeriodFilter(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getSupplierTrend(parseSupplierPeriodFilter(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(
      await listSupplierTransactions(supplierIdFrom(req), parseSupplierPeriodFilter(req.query)),
    );
  } catch (error) {
    next(error);
  }
};

export const postPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res
      .status(201)
      .json(
        await createManualSupplierTransaction(
          supplierIdFrom(req),
          "PAYMENT",
          parseManualSupplierTransaction(req.body),
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const postDebt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res
      .status(201)
      .json(
        await createManualSupplierTransaction(
          supplierIdFrom(req),
          "DEBT_INCREASE",
          parseManualSupplierTransaction(req.body),
        ),
      );
  } catch (error) {
    next(error);
  }
};
