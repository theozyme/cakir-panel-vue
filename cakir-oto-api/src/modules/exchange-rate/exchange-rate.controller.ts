import type { NextFunction, Request, Response } from "express";

import { getUsdExchangeRate } from "./exchange-rate.service.js";

export const getUsdExchangeRateController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await getUsdExchangeRate());
  } catch (error) {
    next(error);
  }
};
