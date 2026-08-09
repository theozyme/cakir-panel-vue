import type { Prisma } from "../../generated/prisma/client.js";

import { getPrisma } from "./prisma.js";
import { isPrismaErrorCode } from "./http-error.js";

export type BusinessTransaction = Prisma.TransactionClient;

export const withSerializableTransaction = async <T>(
  work: (tx: BusinessTransaction) => Promise<T>,
): Promise<T> => {
  const prisma = getPrisma();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (!isPrismaErrorCode(error, "P2034") || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error("Serializable transaction retry limiti asildi");
};
