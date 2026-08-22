import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { getPrisma } from "../../lib/prisma.js";
import { asRecord, requiredString } from "../../lib/validation.js";
import type {
  LoanAccountMaintenanceDto,
  LoanAccountMaintenanceUpdate,
} from "./loan-account-maintenance.types.js";

const parseUpdate = (body: unknown): LoanAccountMaintenanceUpdate => {
  const values = asRecord(body);
  const result: LoanAccountMaintenanceUpdate = {};
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
    await getPrisma().loanAccount.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      select: { id: true },
    }),
  );

export const listLoanAccounts = async (): Promise<LoanAccountMaintenanceDto[]> =>
  getPrisma().loanAccount.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

export const createLoanAccount = async (body: unknown): Promise<LoanAccountMaintenanceDto> => {
  const name = requiredString(asRecord(body).name, "name", 150);
  if (await duplicateName(name)) throw new HttpError(409, "Kredi hesabı adı zaten mevcut");
  try {
    return await getPrisma().loanAccount.create({
      data: { name },
      select: { id: true, name: true, isActive: true },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new HttpError(409, "Kredi hesabı adı zaten mevcut");
    }
    throw error;
  }
};

export const updateLoanAccount = async (
  id: string,
  body: unknown,
): Promise<LoanAccountMaintenanceDto> => {
  const current = await getPrisma().loanAccount.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Kredi hesabı bulunamadı");
  const input = parseUpdate(body);
  if (input.name && (await duplicateName(input.name, id))) {
    throw new HttpError(409, "Kredi hesabı adı zaten mevcut");
  }
  try {
    return await getPrisma().loanAccount.update({
      where: { id },
      data: input,
      select: { id: true, name: true, isActive: true },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new HttpError(409, "Kredi hesabı adı zaten mevcut");
    }
    if (isPrismaErrorCode(error, "P2025")) throw new HttpError(404, "Kredi hesabı bulunamadı");
    throw error;
  }
};
