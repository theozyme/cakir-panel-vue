import type { NextFunction, Request, Response } from "express";

import {
  adjustInventoryStock,
  createInventoryProduct,
  listInventoryProducts,
  parseInventoryListFilter,
  parseInventoryStockType,
  updateInventoryProduct,
} from "./inventory.service.js";

const param = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export const getInventoryProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await listInventoryProducts(parseInventoryListFilter(req.query)));
  } catch (error) {
    next(error);
  }
};

export const postInventoryProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.status(201).json(await createInventoryProduct(req.body));
  } catch (error) {
    next(error);
  }
};

export const patchInventoryProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(
      await updateInventoryProduct(
        parseInventoryStockType(param(req.params.type)),
        param(req.params.id),
        req.body,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const postInventoryStockAdjustment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(
      await adjustInventoryStock(
        parseInventoryStockType(param(req.params.type)),
        param(req.params.id),
        req.body,
      ),
    );
  } catch (error) {
    next(error);
  }
};
