import type { NextFunction, Request, Response } from "express";

import {
  getMigrationModuleStatus,
  importSupplierTransactions,
  importMultimediaStock,
  importScreenStock,
  importSoundOffers,
  importSoundStock,
  importSuppliers,
  importVehicleHistory,
  listSuppliers,
  runMultimediaStockDryRun,
  runScreenStockDryRun,
  runSoundOffersDryRun,
  runSoundStockDryRun,
  runSupplierTransactionsDryRun,
  runSuppliersDryRun,
  runVehicleHistoryDryRun,
} from "./migration.service.js";

export const getMigrationStatus = (_req: Request, res: Response) => {
  res.json(getMigrationModuleStatus());
};

export const getSuppliers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listSuppliers());
  } catch (error) {
    next(error);
  }
};

export const dryRunScreenStockMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await runScreenStockDryRun(req.body));
  } catch (error) {
    next(error);
  }
};

export const importScreenStockMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await importScreenStock(req.body));
  } catch (error) {
    next(error);
  }
};

export const dryRunMultimediaStockMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await runMultimediaStockDryRun(req.body));
  } catch (error) {
    next(error);
  }
};

export const importMultimediaStockMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await importMultimediaStock(req.body));
  } catch (error) {
    next(error);
  }
};

export const dryRunSoundStockMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await runSoundStockDryRun(req.body));
  } catch (error) {
    next(error);
  }
};

export const importSoundStockMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await importSoundStock(req.body));
  } catch (error) {
    next(error);
  }
};

export const dryRunSoundOffersMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await runSoundOffersDryRun(req.body));
  } catch (error) {
    next(error);
  }
};

export const importSoundOffersMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await importSoundOffers(req.body));
  } catch (error) {
    next(error);
  }
};

export const dryRunSuppliersMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await runSuppliersDryRun(req.body));
  } catch (error) {
    next(error);
  }
};

export const importSuppliersMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await importSuppliers(req.body));
  } catch (error) {
    next(error);
  }
};

export const dryRunSupplierTransactionsMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await runSupplierTransactionsDryRun(req.body));
  } catch (error) {
    next(error);
  }
};

export const importSupplierTransactionsMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await importSupplierTransactions(req.body));
  } catch (error) {
    next(error);
  }
};

export const dryRunVehicleHistoryMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await runVehicleHistoryDryRun(req.body as Buffer));
  } catch (error) {
    next(error);
  }
};

export const importVehicleHistoryMigration = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await importVehicleHistory(req.body as Buffer));
  } catch (error) {
    next(error);
  }
};
