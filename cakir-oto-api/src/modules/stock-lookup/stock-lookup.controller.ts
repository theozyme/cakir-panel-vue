import type { NextFunction, Request, Response } from "express";

import {
  listMultimediaProducts,
  listScreenProducts,
  listSoundSystemProducts,
} from "./stock-lookup.service.js";

const queryFlag = (value: unknown, defaultValue: boolean): boolean =>
  value === undefined ? defaultValue : value === "true";

export const getMultimediaProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listMultimediaProducts(queryFlag(req.query.inStock, true)));
  } catch (error) {
    next(error);
  }
};

export const getScreenProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listScreenProducts(queryFlag(req.query.inStock, true)));
  } catch (error) {
    next(error);
  }
};

export const getSoundSystemProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listSoundSystemProducts(queryFlag(req.query.active, true)));
  } catch (error) {
    next(error);
  }
};
