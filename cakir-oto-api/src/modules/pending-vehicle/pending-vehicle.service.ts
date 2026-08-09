import { getPrisma } from "../../lib/prisma.js";
import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { normalizePlate } from "../../lib/plate.js";
import { withSerializableTransaction } from "../../lib/transaction.js";
import { createVisitForPending } from "../vehicle-visit/vehicle-visit.service.js";
import type { ConfirmPendingVehicleResult, PendingVehicleDto } from "./pending-vehicle.types.js";

const toDto = (row: { id: string; plate: string; createdAt: Date }): PendingVehicleDto => ({
  id: row.id,
  plate: row.plate,
  createdAt: row.createdAt.toISOString(),
});

export const listPendingVehicles = async (): Promise<PendingVehicleDto[]> => {
  const rows = await getPrisma().pendingVehicle.findMany({
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toDto);
};

export const createPendingVehicle = async (plateInput: unknown): Promise<PendingVehicleDto> => {
  const plate = normalizePlate(plateInput);

  try {
    const row = await getPrisma().pendingVehicle.create({
      data: { plate },
    });

    return toDto(row);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new HttpError(409, "Bu plaka zaten bekleyen araclar arasinda");
    }

    throw error;
  }
};

export const confirmPendingVehicle = async (
  pendingVehicleId: string,
): Promise<ConfirmPendingVehicleResult> => {
  if (!pendingVehicleId) {
    throw new HttpError(400, "pending vehicle id zorunlu");
  }

  try {
    return await withSerializableTransaction(async (tx) => {
      const pending = await tx.pendingVehicle.findUnique({
        where: { id: pendingVehicleId },
      });

      if (!pending) {
        throw new HttpError(404, "Bekleyen arac bulunamadi veya daha once onaylandi");
      }

      let vehicle = await tx.vehicle.findUnique({
        where: { normalizedPlate: pending.plate },
        select: { id: true, plate: true },
      });

      if (!vehicle) {
        vehicle = await tx.vehicle.create({
          data: {
            plate: pending.plate,
            normalizedPlate: pending.plate,
          },
          select: { id: true, plate: true },
        });
      }

      const arrivalAt = new Date();
      const visit = await createVisitForPending(tx, vehicle.id, arrivalAt);

      await tx.pendingVehicle.delete({
        where: { id: pending.id },
      });

      return {
        pendingVehicleId: pending.id,
        visitId: visit.id,
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        arrivalAt: visit.arrivalAt.toISOString(),
      };
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new HttpError(409, "Plaka eszamanli bir islemde olusturuldu; tekrar deneyin");
    }

    if (isPrismaErrorCode(error, "P2025")) {
      throw new HttpError(409, "Bekleyen arac daha once onaylandi");
    }

    throw error;
  }
};
