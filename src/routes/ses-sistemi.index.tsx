import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, FileText, History, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY, StatusBadge } from "@/components/shared/StatusBadge";
import {
  addAudioProduct,
  deleteAudioProduct,
  updateAudioProduct,
  useAudioStore,
} from "@/store/audioStore";
import type { AudioProduct } from "@/types/audio";

export const Route = createFileRoute("/ses-sistemi/")({
  head: () => ({
    meta: [
      { title: "Ses Sistemi Stokları · Çakır Oto" },
      { name: "description", content: "Ses sistemi ürün stokları, fiyatlar ve teklif yönetimi." },
      { property: "og:title", content: "Ses Sistemi Stokları" },
      { property: "og:description", content: "Ses sistemi stok takibi ve teklif oluşturma." },
    ],
  }),
  component: SesSistemiIndex,
});

const emptyForm = {
  urun: "",
  marka: "",
  alisFiyati: "",
  nakitSatisFiyati: "",
  kartSatisFiyati: "",
  adet: "",
  kritikSeviye: "2",
};

function SesSistemiIndex() {
  const { products } = useAudioStore();
  const [q, setQ] = useState("");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [editing, setEditing] = useState<AudioProduct | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const list = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr");
    return products.filter((p) => {
      const okQ =
        !term ||
        p.urun.toLocaleLowerCase("tr").includes(term) ||
        p.marka.toLocaleLowerCase("tr").includes(term);
      const okC = !onlyCritical || p.adet <= p.kritikSeviye;
      return okQ && okC;
    });
  }, [products, q, onlyCritical]);

  const criticalCount = products.filter((p) => p.adet <= p.kritikSeviye).length;

  return (
    <AppLayout title="Ses Sistemi">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-elevated p-5">
          <div className="text-sm font-bold text-muted-foreground">Toplam Ürün</div>
          <div className="mt-1 text-3xl font-bold">{products.length}</div>
        </div>
        <div className="card-elevated p-5">
          <div className="text-sm font-bold text-muted-foreground">Kritik Stok</div>
          <div className="mt-1 text-3xl font-bold text-warning">{criticalCount}</div>
        </div>
        <div className="card-elevated p-5">
          <div className="text-sm font-bold text-muted-foreground">Stok Değeri (Alış)</div>
          <div className="mt-1 text-3xl font-bold">
            {formatTRY(products.reduce((t, p) => t + p.alisFiyati * p.adet, 0))}
          </div>
        </div>
      </div>

      <div className="mt-6 card-elevated overflow-hidden">
        <div className="grid gap-3 p-5 pb-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Ses Sistemi Stokları</h2>
            <p className="text-xs text-muted-foreground">Ürün fiyatları ve stok adetleri</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ürün ara..."
                className="h-9 w-52 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => setOnlyCritical((v) => !v)}
              className={`h-9 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                onlyCritical
                  ? "border-warning bg-warning/15 text-warning"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Kritik Stok
            </button>
            <Link
              to="/ses-sistemi/teklif-gecmisi"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-semibold hover:bg-accent"
            >
              <History className="h-4 w-4" /> Teklif Geçmişi
            </Link>
            <Link
              to="/ses-sistemi/teklif-ver"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <FileText className="h-4 w-4" /> Teklif Ver
            </Link>
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/15"
            >
              <Plus className="h-4 w-4" /> Yeni Ürün Ekle
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Ürün Adı</th>
                <th className="px-4 py-3 text-right font-semibold">Alış Fiyatı</th>
                <th className="px-4 py-3 text-right font-semibold">Nakit Satış</th>
                <th className="px-4 py-3 text-right font-semibold">Kredi Kartı Satış</th>
                <th className="px-4 py-3 text-right font-semibold">Stok Adedi</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const tone = p.adet === 0 ? "destructive" : p.adet <= p.kritikSeviye ? "warning" : "success";
                const label = p.adet === 0 ? "Tükendi" : p.adet <= p.kritikSeviye ? "Kritik" : "Yeterli";
                return (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.urun}</div>
                      <div className="text-xs text-muted-foreground">{p.marka}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatTRY(p.alisFiyati)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatTRY(p.nakitSatisFiyati)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatTRY(p.kartSatisFiyati)}</td>
                    <td className="px-4 py-3 text-right font-bold">{p.adet}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={tone}>{label}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditing(p);
                            setModalOpen(true);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-primary"
                          aria-label="Güncelle"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            deleteAudioProduct(p.id);
                            toast.success("Ürün silindi");
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-destructive"
                          aria-label="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </AppLayout>
  );
}

function ProductModal({
  product,
  onClose,
}: {
  product: AudioProduct | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    product
      ? {
          urun: product.urun,
          marka: product.marka,
          alisFiyati: String(product.alisFiyati),
          nakitSatisFiyati: String(product.nakitSatisFiyati),
          kartSatisFiyati: String(product.kartSatisFiyati),
          adet: String(product.adet),
          kritikSeviye: String(product.kritikSeviye),
        }
      : emptyForm,
  );

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.urun.trim()) {
      toast.error("Ürün adı zorunlu");
      return;
    }
    const payload = {
      urun: form.urun.trim(),
      marka: form.marka.trim(),
      alisFiyati: Number(form.alisFiyati) || 0,
      nakitSatisFiyati: Number(form.nakitSatisFiyati) || 0,
      kartSatisFiyati: Number(form.kartSatisFiyati) || 0,
      adet: Number(form.adet) || 0,
      kritikSeviye: Number(form.kritikSeviye) || 0,
    };
    if (product) {
      updateAudioProduct(product.id, payload);
      toast.success("Ürün güncellendi");
    } else {
      addAudioProduct({ id: `a${Date.now()}`, ...payload });
      toast.success("Ürün eklendi");
    }
    onClose();
  };

  const fields: Array<[keyof typeof emptyForm, string, string]> = [
    ["urun", "Ürün Adı", "text"],
    ["marka", "Marka", "text"],
    ["alisFiyati", "Alış Fiyatı", "number"],
    ["nakitSatisFiyati", "Nakit Satış Fiyatı", "number"],
    ["kartSatisFiyati", "Kredi Kartı Satış Fiyatı", "number"],
    ["adet", "Stok Adedi", "number"],
    ["kritikSeviye", "Kritik Seviye", "number"],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">{product ? "Ürünü Güncelle" : "Yeni Ürün Ekle"}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([key, label, type]) => (
            <label key={key} className={`text-sm ${key === "urun" ? "sm:col-span-2" : ""}`}>
              <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-semibold hover:bg-accent"
          >
            İptal
          </button>
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}
