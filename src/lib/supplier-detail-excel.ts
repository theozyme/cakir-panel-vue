import ExcelJS from "exceljs";
import type { Cell, Row, Worksheet } from "exceljs";

import type { MailOrderSupplier, SupplierTransaction } from "@/types/business";

type SupplierDetailExportInput = {
  supplier: MailOrderSupplier;
  periodLabel: string;
  debtTotal: string;
  paymentTotal: string;
  transactions: SupplierTransaction[];
};

const numberFormat = "#,##0.00;[Red]-#,##0.00";
const darkFill = "FF1E293B";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const styleTitle = (cell: Cell) => {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkFill } };
};

const styleHeader = (row: Row) => {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkFill } };
};

const addTransactions = (
  sheet: Worksheet,
  title: string,
  rows: SupplierTransaction[],
  startRow: number,
) => {
  sheet.mergeCells(startRow, 1, startRow, 6);
  sheet.getCell(startRow, 1).value = title;
  sheet.getCell(startRow, 1).font = { bold: true, size: 12 };

  const header = sheet.getRow(startRow + 1);
  header.values = ["Tarih", "Tutar", "Bakiye", "Not", "Kaynak", "Durum"];
  styleHeader(header);

  rows.forEach((transaction, index) => {
    const row = sheet.getRow(startRow + index + 2);
    row.values = [
      formatDate(transaction.transactionAt),
      Number(transaction.amount),
      transaction.balanceAfter === null ? null : Number(transaction.balanceAfter),
      transaction.note ?? "",
      transaction.sourceType === "MANUAL"
        ? "Manuel"
        : transaction.sourceType === "VEHICLE_OPERATION"
          ? "Araç işlemi"
          : "Aktarım",
      transaction.voidedAt ? "Geri alındı" : "Aktif",
    ];
    row.getCell(2).numFmt = numberFormat;
    row.getCell(3).numFmt = numberFormat;
  });

  return startRow + rows.length + 3;
};

export const exportSupplierDetailWorkbook = async (input: SupplierDetailExportInput) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Çakır Oto Panel";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Firma Raporu", {
    views: [{ state: "frozen", ySplit: 7 }],
  });
  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = `${input.supplier.name} · Firma Detaylı Rapor`;
  sheet.getRow(1).height = 26;
  styleTitle(sheet.getCell("A1"));
  sheet.getCell("A2").value = `Dönem: ${input.periodLabel}`;
  sheet.getCell("A3").value = `Para birimi: ${input.supplier.currency}`;

  const totalsHeader = sheet.getRow(5);
  totalsHeader.values = ["SEÇİLİ DÖNEM TOPLAMLARI", "Toplam Mal Girişi", "Toplam Ödeme"];
  styleHeader(totalsHeader);
  const totals = sheet.getRow(6);
  totals.values = [input.supplier.currency, Number(input.debtTotal), Number(input.paymentTotal)];
  for (let column = 2; column <= 3; column += 1) totals.getCell(column).numFmt = numberFormat;

  const byNewest = (first: SupplierTransaction, second: SupplierTransaction) =>
    new Date(second.transactionAt).getTime() - new Date(first.transactionAt).getTime();
  const debts = input.transactions.filter((item) => item.type === "DEBT_INCREASE").sort(byNewest);
  const payments = input.transactions.filter((item) => item.type === "PAYMENT").sort(byNewest);
  const nextRow = addTransactions(sheet, "MAL GİRİŞLERİ", debts, 8);
  addTransactions(sheet, "ÖDEMELER", payments, nextRow);

  sheet.columns = [
    { width: 21 },
    { width: 18 },
    { width: 18 },
    { width: 48 },
    { width: 18 },
    { width: 16 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = input.supplier.name
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü]+/gi, "-");
  link.download = `firma-raporu-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
