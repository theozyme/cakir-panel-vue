import { getPrisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { withSerializableTransaction, type BusinessTransaction } from "../../lib/transaction.js";
import type { CreateVehicleVisitResponse, VehicleVisitDetail } from "./vehicle-visit.types.js";

export const createVisitForPending = async (
  tx: BusinessTransaction,
  vehicleId: string,
  arrivalAt: Date,
) =>
  tx.vehicleVisit.create({
    data: {
      vehicleId,
      arrivalAt,
    },
    select: {
      id: true,
      vehicleId: true,
      arrivalAt: true,
    },
  });

export const getVehicleVisitDetail = async (visitId: string): Promise<VehicleVisitDetail> => {
  const visit = await getPrisma().vehicleVisit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      arrivalAt: true,
      note: true,
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          note: true,
        },
      },
    },
  });

  if (!visit) {
    throw new HttpError(404, "VehicleVisit bulunamadi");
  }

  return {
    ...visit,
    arrivalAt: visit.arrivalAt.toISOString(),
  };
};

export const createVisitForVehicle = async (
  vehicleId: string,
): Promise<CreateVehicleVisitResponse> => {
  if (!vehicleId) throw new HttpError(400, "vehicleId zorunlu");

  return withSerializableTransaction(async (tx) => {
    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!vehicle) throw new HttpError(404, "Vehicle bulunamadi");

    const latestCustomerVisit = await tx.vehicleVisit.findFirst({
      where: { vehicleId, customerId: { not: null } },
      orderBy: [{ arrivalAt: "desc" }, { id: "desc" }],
      select: { customerId: true },
    });
    const arrivalAt = new Date();
    const visit = await tx.vehicleVisit.create({
      data: {
        vehicleId,
        arrivalAt,
        customerId: latestCustomerVisit?.customerId ?? null,
      },
      select: { id: true, vehicleId: true, arrivalAt: true },
    });

    return {
      visitId: visit.id,
      vehicleId: visit.vehicleId,
      arrivalAt: visit.arrivalAt.toISOString(),
    };
  });
};
