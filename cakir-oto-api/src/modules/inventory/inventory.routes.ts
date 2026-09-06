import { Router } from "express";

import {
  getInventoryProducts,
  deleteInventoryProductController,
  patchInventoryProduct,
  postInventoryProduct,
  postInventoryStockAdjustment,
} from "./inventory.controller.js";

export const inventoryRouter = Router();

inventoryRouter.get("/products", getInventoryProducts);
inventoryRouter.post("/products", postInventoryProduct);
inventoryRouter.patch("/products/:type/:id", patchInventoryProduct);
inventoryRouter.delete("/products/:type/:id", deleteInventoryProductController);
inventoryRouter.post("/products/:type/:id/adjust-stock", postInventoryStockAdjustment);
