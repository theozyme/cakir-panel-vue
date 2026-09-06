import type { NextFunction, Request, Response } from "express";
import * as service from "./goods-entry.service.js";

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listProducts(req.query)); } catch (error) { next(error); }
}
export async function postEntry(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEntry(req.body)); } catch (error) { next(error); }
}
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.history(String(req.params.id), req.query)); } catch (error) { next(error); }
}
export async function getStatistics(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.statistics(req.query)); } catch (error) { next(error); }
}
