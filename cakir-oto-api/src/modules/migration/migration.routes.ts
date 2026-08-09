import { Router, raw } from "express";

import {
  dryRunMultimediaStockMigration,
  dryRunScreenStockMigration,
  dryRunSoundOffersMigration,
  dryRunSoundStockMigration,
  dryRunSupplierTransactionsMigration,
  dryRunSuppliersMigration,
  dryRunVehicleHistoryMigration,
  getMigrationStatus,
  getSuppliers,
  importMultimediaStockMigration,
  importScreenStockMigration,
  importSoundOffersMigration,
  importSoundStockMigration,
  importSupplierTransactionsMigration,
  importSuppliersMigration,
  importVehicleHistoryMigration,
} from "./migration.controller.js";

export const migrationRouter = Router();
const zipUpload = raw({
  type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
  limit: "500mb",
});

migrationRouter.get("/status", getMigrationStatus);
migrationRouter.get("/suppliers", getSuppliers);
migrationRouter.post("/screen-stock/dry-run", dryRunScreenStockMigration);
migrationRouter.post("/screen-stock/import", importScreenStockMigration);
migrationRouter.post("/multimedia-stock/dry-run", dryRunMultimediaStockMigration);
migrationRouter.post("/multimedia-stock/import", importMultimediaStockMigration);
migrationRouter.post("/sound-stock/dry-run", dryRunSoundStockMigration);
migrationRouter.post("/sound-stock/import", importSoundStockMigration);
migrationRouter.post("/sound-offers/dry-run", dryRunSoundOffersMigration);
migrationRouter.post("/sound-offers/import", importSoundOffersMigration);
migrationRouter.post("/suppliers/dry-run", dryRunSuppliersMigration);
migrationRouter.post("/suppliers/import", importSuppliersMigration);
migrationRouter.post("/supplier-transactions/dry-run", dryRunSupplierTransactionsMigration);
migrationRouter.post("/supplier-transactions/import", importSupplierTransactionsMigration);
migrationRouter.post("/vehicle-history/dry-run", zipUpload, dryRunVehicleHistoryMigration);
migrationRouter.post("/vehicle-history/import", zipUpload, importVehicleHistoryMigration);
