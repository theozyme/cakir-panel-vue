import cors from "cors";
import "dotenv/config";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";

import { migrationRouter } from "./modules/migration/migration.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { loanAccountMaintenanceRouter } from "./modules/loan-account-maintenance/loan-account-maintenance.routes.js";
import { exchangeRateRouter } from "./modules/exchange-rate/exchange-rate.routes.js";
import { pendingVehicleRouter } from "./modules/pending-vehicle/pending-vehicle.routes.js";
import { personnelMaintenanceRouter } from "./modules/personnel-maintenance/personnel-maintenance.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { soundOfferRouter } from "./modules/sound-offer/sound-offer.routes.js";
import { specialPaymentRouter } from "./modules/special-payment/special-payment.routes.js";
import { stockLookupRouter } from "./modules/stock-lookup/stock-lookup.routes.js";
import { stockOrderRouter } from "./modules/stock-order/stock-order.routes.js";
import { supplierRouter } from "./modules/supplier/supplier.routes.js";
import { vehicleOperationRouter } from "./modules/vehicle-operation/vehicle-operation.routes.js";
import { vehicleVisitRouter } from "./modules/vehicle-visit/vehicle-visit.routes.js";
import { vehicleRouter } from "./modules/vehicle/vehicle.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Çakır Oto API çalışıyor",
  });
});

app.use("/api/admin/migration", migrationRouter);
app.use("/api/pending-vehicles", pendingVehicleRouter);
app.use("/api/vehicle-visits", vehicleVisitRouter);
app.use("/api/vehicle-operations", vehicleOperationRouter);
app.use("/api/vehicles", vehicleRouter);
app.use("/api/stock", stockLookupRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/stock-orders", stockOrderRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/exchange-rates", exchangeRateRouter);
app.use("/api/sound-offers", soundOfferRouter);
app.use("/api/special-payments", specialPaymentRouter);
app.use("/api/personnel-maintenance", personnelMaintenanceRouter);
app.use("/api/loan-account-maintenance", loanAccountMaintenanceRouter);
app.use("/api/reports", reportsRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Endpoint bulunamadı",
  });
});

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err?.message ?? "Sunucu hatası",
  });
};

app.use(errorHandler);
