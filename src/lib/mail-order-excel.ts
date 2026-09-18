import ExcelJS from "exceljs";
import type { Cell, Row, Worksheet } from "exceljs";

import type { Currency, MailOrderExport, MailOrderExportTotals } from "@/types/business";

const currencies: Currency[] = ["TRY", "USD"];
const numberFormat = "#,##0.00;[Red]-#,##0.00";
const headerFill = "FF1E293B";
const accentFill = "FFE2E8F0";

const asNumber = (value: string | null) => (value === null ? null : Number(value));

const styleTitle = (cell: Cell) => {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 15 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
};

const styleHeader = (row: Row) => {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
};

const addTotals = (
  sheet: Worksheet,
  title: string,
  totals: MailOrderExportTotals,
  startRow: number,
) => {
  sheet.mergeCells(startRow, 1, startRow, 4);
  const titleCell = sheet.getCell(startRow, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 12 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accentFill } };

  const header = sheet.getRow(startRow + 1);
  header.values = ["Para Birimi", "Toplam Mal Girişi", "Toplam Ödeme", "Net Borç"];
  styleHeader(header);

  currencies.forEach((currency, index) => {
    const rowNumber = startRow + index + 2;
    const row = sheet.getRow(rowNumber);
    row.values = [
      currency,
      asNumber(totals[currency].debtIncrease),
      asNumber(totals[currency].payments),
      { formula: `B${rowNumber}-C${rowNumber}` },
    ];
    row.getCell(1).font = { bold: true };
    for (let column = 2; column <= 4; column += 1) row.getCell(column).numFmt = numberFormat;
  });
};

const formatIstanbulDate = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const sourceLabels: Record<
  MailOrderExport["years"][number]["transactions"][number]["sourceType"],
  string
> = {
  MANUAL: "Manuel",
  VEHICLE_OPERATION: "Araç işlemi",
  MIGRATION: "Aktarım",
};

export const exportMailOrderWorkbook = async (data: MailOrderExport) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Çakır Oto Panel";
  workbook.created = new Date(data.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  const summary = workbook.addWorksheet("Genel Özet", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  summary.mergeCells("A1:E1");
  summary.getCell("A1").value = "Mail Order · Tüm Yıllar Genel Özeti";
  summary.getRow(1).height = 28;
  styleTitle(summary.getCell("A1"));
  summary.getCell("A2").value = `Rapor tarihi: ${formatIstanbulDate(data.generatedAt)}`;
  addTotals(summary, "OVERALL TOPLAMLAR", data.overall, 4);

  const yearlyHeaderRow = 9;
  const yearlyHeader = summary.getRow(yearlyHeaderRow);
  yearlyHeader.values = ["Yıl", "Para Birimi", "Mal Girişi", "Ödeme", "Net Borç"];
  styleHeader(yearlyHeader);
  let summaryRow = yearlyHeaderRow + 1;
  for (const year of data.years) {
    for (const currency of currencies) {
      const row = summary.getRow(summaryRow);
      row.values = [
        year.year,
        currency,
        asNumber(year.totals[currency].debtIncrease),
        asNumber(year.totals[currency].payments),
        { formula: `C${summaryRow}-D${summaryRow}` },
      ];
      for (let column = 3; column <= 5; column += 1) row.getCell(column).numFmt = numberFormat;
      summaryRow += 1;
    }
  }
  summary.autoFilter = {
    from: `A${yearlyHeaderRow}`,
    to: `E${Math.max(yearlyHeaderRow, summaryRow - 1)}`,
  };
  summary.columns = [{ width: 12 }, { width: 16 }, { width: 22 }, { width: 22 }, { width: 22 }];

  for (const year of data.years) {
    const sheet = workbook.addWorksheet(String(year.year), {
      views: [{ state: "frozen", ySplit: 8 }],
    });
    sheet.mergeCells("A1:I1");
    sheet.getCell("A1").value = `${year.year} Mail Order Hareketleri`;
    sheet.getRow(1).height = 28;
    styleTitle(sheet.getCell("A1"));
    addTotals(sheet, `${year.year} YILI TOPLAMLARI`, year.totals, 3);

    const transactionHeaderRow = 8;
    const header = sheet.getRow(transactionHeaderRow);
    header.values = [
      "Tarih",
      "Firma",
      "Firma Durumu",
      "Para Birimi",
      "Mal Girişi",
      "Ödeme",
      "Hareket Sonrası Bakiye",
      "Açıklama",
      "Kaynak",
    ];
    styleHeader(header);

    year.transactions.forEach((transaction, index) => {
      const row = sheet.getRow(transactionHeaderRow + index + 1);
      const amount = asNumber(transaction.amount);
      row.values = [
        formatIstanbulDate(transaction.transactionAt),
        transaction.supplierName,
        transaction.supplierIsActive ? "Aktif" : "Pasif",
        transaction.currency,
        transaction.type === "DEBT_INCREASE" ? amount : null,
        transaction.type === "PAYMENT" ? amount : null,
        asNumber(transaction.balanceAfter),
        transaction.note ?? "",
        sourceLabels[transaction.sourceType],
      ];
      for (let column = 5; column <= 7; column += 1) row.getCell(column).numFmt = numberFormat;
    });

    const lastRow = Math.max(transactionHeaderRow, transactionHeaderRow + year.transactions.length);
    sheet.autoFilter = { from: `A${transactionHeaderRow}`, to: `I${lastRow}` };
    sheet.columns = [
      { width: 20 },
      { width: 30 },
      { width: 15 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
      { width: 24 },
      { width: 42 },
      { width: 16 },
    ];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mail-order-tum-yillar-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
