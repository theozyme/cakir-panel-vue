import type { NextFunction, Request, Response } from "express";

import {
  createLoanAccount,
  listLoanAccounts,
  updateLoanAccount,
} from "./loan-account-maintenance.service.js";

const idFrom = (req: Request): string => {
  const value = req.params.id;
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
};

export const getLoanAccounts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listLoanAccounts());
  } catch (error) {
    next(error);
  }
};

export const postLoanAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createLoanAccount(req.body));
  } catch (error) {
    next(error);
  }
};

export const patchLoanAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateLoanAccount(idFrom(req), req.body));
  } catch (error) {
    next(error);
  }
};
