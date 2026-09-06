import { apiRequest } from "@/lib/api";
import { inventoryProductLabel, inventoryStatusLabels, inventoryTypeLabels, type InventoryListResponse, type InventoryProduct } from "@/types/inventory";

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

export async function printInventoryPdf(queryString: string, secondary: (product: InventoryProduct) => string): Promise<void> {
  // Open synchronously from the click so browsers do not block the report window.
  const report = window.open("", "_blank");
  if (!report) throw new Error("Rapor için açılır pencerelere izin verin.");
  report.opener = null;
  report.document.title = "Çakır Oto - Mevcut Stok Raporu";
  report.document.body.textContent = "Stok raporu hazırlanıyor...";
  try {
    const params = new URLSearchParams(queryString);
    params.set("pageSize", "100");
    const products: InventoryProduct[] = [];
    for (let page = 1; ; page++) {
      params.set("page", String(page));
      const result = await apiRequest<InventoryListResponse>(`/api/inventory/products?${params}`);
      products.push(...result.items);
      if (page * result.pageSize >= result.total || result.items.length === 0) break;
      if (report.closed) return;
    }
    if (report.closed) return;
    const activeLabel = params.get("active") === "all" ? "Tüm ürünler" : params.get("active") === "false" ? "Pasif ürünler" : "Aktif ürünler";
    const filters = [activeLabel, params.get("search") ? `Arama: ${params.get("search")}` : "", params.get("criticalOnly") === "true" ? "Sadece kritik stok" : ""].filter(Boolean).join(" · ");
    const rows = products.map((product) => `<tr>
      <td><strong>${escapeHtml(inventoryProductLabel(product))}</strong></td>
      <td>${escapeHtml(inventoryTypeLabels[product.type])}</td>
      <td>${escapeHtml(secondary(product) || "—")}</td>
      <td class="number">${product.quantity}</td>
      <td class="number">${product.criticalStockLevel}</td>
      <td>${escapeHtml(inventoryStatusLabels[product.status])}<br>${product.isActive ? "Aktif" : "Pasif"}</td>
    </tr>`).join("");
    report.document.documentElement.lang = "tr";
    const charset = report.document.createElement("meta");
    charset.setAttribute("charset", "utf-8");
    report.document.head.append(charset);
    const style = report.document.createElement("style");
    style.textContent = `
      @page { size: A4 landscape; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font: 11px Arial, sans-serif; color: #172033; margin: 24px; }
      h1 { font-size: 22px; margin: 0 0 10px; }
      p { color: #475569; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 18px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #eef2f6; font-size: 10px; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .number { text-align: right; }
      .toolbar { margin-bottom: 24px; }
      button { padding: 10px 16px; cursor: pointer; }
      @media print { body { margin: 0; } .toolbar { display: none; } }
    `;
    report.document.head.append(style);
    report.document.body.innerHTML = `
      <div class="toolbar"><button type="button">PDF olarak kaydet / Yazdır</button><p>Yazdırma penceresinde hedef olarak “PDF olarak kaydet” seçin.</p></div>
      <h1>Çakır Oto - Mevcut Stok Raporu</h1>
      <p>Rapor tarihi: ${escapeHtml(new Date().toLocaleString("tr-TR"))}<br>${escapeHtml(filters)}<br>
      Ürün sayısı: ${products.length} · Toplam adet: ${products.reduce((sum, product) => sum + product.quantity, 0)}</p>
      <table><colgroup><col style="width:24%"><col style="width:13%"><col style="width:31%"><col style="width:8%"><col style="width:8%"><col style="width:16%"></colgroup>
      <thead><tr><th>Ürün / Model</th><th>Stok Tipi</th><th>Ürün Bilgileri</th><th>Mevcut Adet</th><th>Kritik Seviye</th><th>Durum</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Seçili filtrelerde stok kaydı bulunamadı.</td></tr>'}</tbody></table>`;
    report.document.querySelector("button")!.addEventListener("click", () => report.print());
    report.focus();
    report.setTimeout(() => { if (!report.closed) report.print(); }, 200);
  } catch (error) {
    report.close();
    throw error;
  }
}
