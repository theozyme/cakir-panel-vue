import { Router } from "express";

import {
  getStockOrderController,
  getStockOrders,
  patchStockOrder,
  postCancelStockOrder,
  postReceiveStockOrder,
  postStockOrder,
  postSubmitStockOrder,
} from "./stock-order.controller.js";

export const stockOrderRouter = Router();

stockOrderRouter.get("/", getStockOrders);
stockOrderRouter.post("/", postStockOrder);
stockOrderRouter.get("/:id", getStockOrderController);
stockOrderRouter.patch("/:id", patchStockOrder);
stockOrderRouter.post("/:id/submit", postSubmitStockOrder);
stockOrderRouter.post("/:id/receive", postReceiveStockOrder);
stockOrderRouter.post("/:id/cancel", postCancelStockOrder);
