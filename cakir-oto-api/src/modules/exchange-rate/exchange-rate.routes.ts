import { Router } from "express";

import { getUsdExchangeRateController } from "./exchange-rate.controller.js";

export const exchangeRateRouter = Router();

exchangeRateRouter.get("/usd", getUsdExchangeRateController);
