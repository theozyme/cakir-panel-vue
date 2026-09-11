import type { NextFunction, Request, Response } from "express";

import { getUsdExchangeRate } from "./exchange-rate.service.js";
import { HttpError } from "../../lib/http-error.js";

export const getUsdExchangeRateController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.query.date !== undefined && typeof req.query.date !== "string") throw new HttpError(400, "Kur tarihi YYYY-MM-DD olmali");
    res.json(await getUsdExchangeRate(req.query.date as string | undefined));
  } catch (error) {
    next(error);
  }
};
