import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { getPrisma } from "../../lib/prisma.js";
import { asRecord, requiredString } from "../../lib/validation.js";

const noteContent = (body: unknown) => requiredString(asRecord(body).content, "Not", 10000);

const requireSupplier = async (supplierId: string) => {
  const supplier = await getPrisma().supplier.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });
  if (!supplier) throw new HttpError(404, "Firma bulunamadı");
};

export const listSupplierNotes = async (supplierId: string) => {
  await requireSupplier(supplierId);
  return getPrisma().supplierNote.findMany({
    where: { supplierId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });
};

export const createSupplierNote = async (supplierId: string, body: unknown) => {
  const content = noteContent(body);
  await requireSupplier(supplierId);
  try {
    return await getPrisma().supplierNote.create({ data: { supplierId, content } });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2003")) throw new HttpError(404, "Firma bulunamadı");
    throw error;
  }
};

export const updateSupplierNote = async (supplierId: string, noteId: string, body: unknown) => {
  const content = noteContent(body);
  try {
    return await getPrisma().supplierNote.update({
      where: { id: noteId, supplierId },
      data: { content },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) throw new HttpError(404, "Firma notu bulunamadı");
    throw error;
  }
};

export const deleteSupplierNote = async (supplierId: string, noteId: string) => {
  try {
    await getPrisma().supplierNote.delete({ where: { id: noteId, supplierId } });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) throw new HttpError(404, "Firma notu bulunamadı");
    throw error;
  }
};
