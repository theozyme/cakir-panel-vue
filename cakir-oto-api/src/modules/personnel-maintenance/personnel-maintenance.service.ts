import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { getPrisma } from "../../lib/prisma.js";
import { asRecord, requiredString } from "../../lib/validation.js";
import type {
  PersonnelMaintenanceDto,
  PersonnelMaintenanceUpdate,
} from "./personnel-maintenance.types.js";

const parseUpdate = (body: unknown): PersonnelMaintenanceUpdate => {
  const values = asRecord(body);
  const result: PersonnelMaintenanceUpdate = {};
  if ("name" in values) result.name = requiredString(values.name, "name", 150);
  if ("isActive" in values) {
    if (typeof values.isActive !== "boolean") throw new HttpError(400, "isActive boolean olmalı");
    result.isActive = values.isActive;
  }
  if (result.name === undefined && result.isActive === undefined) {
    throw new HttpError(400, "name veya isActive alanlarından biri zorunlu");
  }
  return result;
};

const duplicateName = async (name: string, excludedId?: string): Promise<boolean> =>
  Boolean(
    await getPrisma().expensePersonnel.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      select: { id: true },
    }),
  );

export const listPersonnel = async (): Promise<PersonnelMaintenanceDto[]> =>
  getPrisma().expensePersonnel.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

export const createPersonnel = async (body: unknown): Promise<PersonnelMaintenanceDto> => {
  const name = requiredString(asRecord(body).name, "name", 150);
  if (await duplicateName(name)) throw new HttpError(409, "Personel adı zaten mevcut");
  try {
    return await getPrisma().expensePersonnel.create({
      data: { name },
      select: { id: true, name: true, isActive: true },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw new HttpError(409, "Personel adı zaten mevcut");
    throw error;
  }
};

export const updatePersonnel = async (
  id: string,
  body: unknown,
): Promise<PersonnelMaintenanceDto> => {
  const current = await getPrisma().expensePersonnel.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Personel bulunamadı");
  const input = parseUpdate(body);
  if (input.name && (await duplicateName(input.name, id))) {
    throw new HttpError(409, "Personel adı zaten mevcut");
  }
  try {
    return await getPrisma().expensePersonnel.update({
      where: { id },
      data: input,
      select: { id: true, name: true, isActive: true },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw new HttpError(409, "Personel adı zaten mevcut");
    if (isPrismaErrorCode(error, "P2025")) throw new HttpError(404, "Personel bulunamadı");
    throw error;
  }
};
