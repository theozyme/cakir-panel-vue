import type { NextFunction, Request, Response } from "express";

import {
  cancelStockOrder,
  createStockOrder,
  getStockOrder,
  listStockOrders,
  parseStockOrderListFilter,
  receiveStockOrder,
  submitStockOrder,
  updateDraftStockOrder,
} from "./stock-order.service.js";

const idFrom = (req: Request): string => {
  const value = req.params.id;
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
};

export const getStockOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listStockOrders(parseStockOrderListFilter(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getStockOrderController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await getStockOrder(idFrom(req)));
  } catch (error) {
    next(error);
  }
};

export const postStockOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createStockOrder(req.body));
  } catch (error) {
    next(error);
  }
};

export const patchStockOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateDraftStockOrder(idFrom(req), req.body));
  } catch (error) {
    next(error);
  }
};

export const postSubmitStockOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await submitStockOrder(idFrom(req)));
  } catch (error) {
    next(error);
  }
};

export const postReceiveStockOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await receiveStockOrder(idFrom(req)));
  } catch (error) {
    next(error);
  }
};

export const postCancelStockOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await cancelStockOrder(idFrom(req)));
  } catch (error) {
    next(error);
  }
};
