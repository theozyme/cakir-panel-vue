import { getPrisma } from "../../lib/prisma.js";
import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { normalizePlate } from "../../lib/plate.js";
import type { PendingVehicleDto } from "./pending-vehicle.types.js";
import { getVehicleIntakeContext } from "../vehicle/vehicle.service.js";
import type { VehicleIntakeContext } from "../vehicle/vehicle.types.js";

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

export const getPendingVehicle = async (id: string): Promise<PendingVehicleDto & { intakeContext: VehicleIntakeContext | null }> => {
  if (!id) throw new HttpError(400, "pending vehicle id zorunlu");
  const row = await getPrisma().pendingVehicle.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, "Bekleyen arac bulunamadi");
  const vehicle = await getPrisma().vehicle.findUnique({
    where: { normalizedPlate: normalizePlate(row.plate) },
    select: { id: true },
  });
  return { ...toDto(row), intakeContext: vehicle ? await getVehicleIntakeContext(vehicle.id) : null };
};

export const cancelPendingVehicle = async (id: string): Promise<void> => {
  if (!id) throw new HttpError(400, "pending vehicle id zorunlu");
  const result = await getPrisma().pendingVehicle.deleteMany({ where: { id } });
  if (result.count !== 1) throw new HttpError(409, "Bekleyen araç daha önce işleme alındı veya iptal edildi");
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
