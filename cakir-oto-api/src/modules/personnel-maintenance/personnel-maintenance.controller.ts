import type { NextFunction, Request, Response } from "express";

import {
  createPersonnel,
  listPersonnel,
  updatePersonnel,
} from "./personnel-maintenance.service.js";

const idFrom = (req: Request): string => {
  const value = req.params.id;
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
};

export const getPersonnel = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listPersonnel());
  } catch (error) {
    next(error);
  }
};

export const postPersonnel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createPersonnel(req.body));
  } catch (error) {
    next(error);
  }
};

export const patchPersonnel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updatePersonnel(idFrom(req), req.body));
  } catch (error) {
    next(error);
  }
};
