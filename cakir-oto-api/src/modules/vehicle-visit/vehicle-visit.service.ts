import { getPrisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import type { VehicleVisitDetail } from "./vehicle-visit.types.js";

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
