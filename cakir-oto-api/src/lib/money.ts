import { Prisma } from "../../generated/prisma/client.js";

import { HttpError } from "./http-error.js";

export const parseMoney = (value: unknown, fieldName: string): Prisma.Decimal => {
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} decimal string olmali`);
  }

  const text = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new HttpError(400, `${fieldName} pozitif ve en fazla 2 ondalik basamakli olmali`);
  }

  const decimal = new Prisma.Decimal(text);

  if (!decimal.isPositive()) {
    throw new HttpError(400, `${fieldName} sifirdan buyuk olmali`);
  }

  return decimal;
};

export const moneyToString = (value: Prisma.Decimal): string => value.toFixed(2);
