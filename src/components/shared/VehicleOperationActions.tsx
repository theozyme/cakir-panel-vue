import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiError, apiRequest } from "@/lib/api";

type Props = {
  operationId: string;
  revision: number;
  hasStockImpact: boolean;
  hasMailOrderImpact: boolean;
};

const invalidationRoots = [
  "vehicle-operations",
  "vehicle-history",
  "daily-operations",
  "inventory",
  "stock",
  "sound-offer",
  "sound-offers",
  "suppliers",
  "mail-order",
  "reports",
  "dashboard",
];

export function VehicleOperationActions({
  operationId,
  revision,
  hasStockImpact,
  hasMailOrderImpact,
}: Props) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all(
      invalidationRoots.map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
    );
  const deletion = useMutation({
    mutationFn: () =>
      apiRequest(`/api/vehicle-operations/${operationId}`, {
        method: "DELETE",
        body: JSON.stringify({ revision }),
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("İşlem silindi; bağlı kayıtlar güvenli biçimde revize edildi.");
    },
    onError: async (error: Error) => {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        (error.message.includes("degistirildi") || error.message.includes("silindi"))
      ) {
        await invalidate();
        toast.error("Kayıt başka bir işlemle değişti. Güncel veri yeniden yüklendi.");
        return;
      }
      toast.error(error.message);
    },
  });

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        to="/araclar/yeni"
        search={{ operationId }}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-input px-2 text-xs font-semibold hover:bg-muted"
      >
        <Pencil className="h-3.5 w-3.5" /> Düzenle
      </Link>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={deletion.isPending}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-destructive/40 px-2 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
          >
            {deletion.isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Sil
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlemi sil</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Bu işlem silinecektir. İşleme bağlı stoklar geri yüklenecek ve ilgili tutar
                  revizyonları yapılacaktır. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                </p>
                {hasStockImpact && (
                  <p>Bu işlem silindiğinde ilgili ürünler stoklara geri eklenecektir.</p>
                )}
                {hasMailOrderImpact && (
                  <p>İlgili toptancı ödeme ve bakiye kayıtları yeniden düzenlenecektir.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletion.isPending}
              onClick={(event) => {
                event.preventDefault();
                deletion.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              İşlemi sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
