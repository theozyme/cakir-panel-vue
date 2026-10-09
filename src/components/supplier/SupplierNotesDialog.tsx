import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import type { SupplierNote } from "@/types/supplier-note";

const formatNoteDate = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const ruledPaper = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, transparent 0, transparent 31px, #d6dce4 31px, #d6dce4 32px)",
};

export function SupplierNotesDialog({
  supplierId,
  supplierName,
  open,
  onOpenChange,
}: {
  supplierId: string;
  supplierName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [editingNote, setEditingNote] = useState<SupplierNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierNote | null>(null);
  const queryKey = ["supplier-notes", supplierId];
  const notesQuery = useQuery({
    queryKey,
    queryFn: () => apiRequest<SupplierNote[]>(`/api/suppliers/${supplierId}/notes`),
    enabled: open,
  });
  const notes = notesQuery.data ?? [];

  const resetEditor = () => {
    setContent("");
    setEditingNote(null);
  };

  const saveMutation = useMutation({
    mutationFn: ({ noteId, text }: { noteId: string | null; text: string }) =>
      apiRequest<SupplierNote>(`/api/suppliers/${supplierId}/notes${noteId ? `/${noteId}` : ""}`, {
        method: noteId ? "PATCH" : "POST",
        body: JSON.stringify({ content: text }),
      }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey });
      resetEditor();
      toast.success(variables.noteId ? "Not güncellendi" : "Not eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest(`/api/suppliers/${supplierId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: async (_result, noteId) => {
      await queryClient.invalidateQueries({ queryKey });
      if (editingNote?.id === noteId) resetEditor();
      setDeleteTarget(null);
      toast.success("Not silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const isPending = saveMutation.isPending || deleteMutation.isPending;

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    const text = content.trim();
    if (!text || isPending) return;
    saveMutation.mutate({ noteId: editingNote?.id ?? null, text });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (isPending) return;
          if (!nextOpen) {
            resetEditor();
            setDeleteTarget(null);
          }
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="flex h-[90dvh] max-h-[900px] w-[calc(100%-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl p-0">
          <DialogHeader className="shrink-0 border-b border-border bg-muted/40 px-5 py-5 text-left sm:px-8">
            <DialogTitle className="flex items-center gap-2 pr-6 text-xl">
              <NotebookPen className="h-5 w-5 shrink-0 text-primary" /> Firma Not Defteri
            </DialogTitle>
            <DialogDescription className="break-words">
              {supplierName} · En güncel notlar en üstte
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f4efe4] px-3 py-5 sm:px-7">
            <div className="relative min-h-full rounded-r-lg border border-[#e5dcc8] bg-[#fffdf5] py-5 pl-8 pr-4 text-slate-800 shadow-sm sm:pl-14 sm:pr-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-5 border-l border-red-300/70 sm:left-9"
              />
              <form onSubmit={submitNote} className="mb-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="supplier-note-content" className="text-sm font-bold">
                    {editingNote ? "Notu düzenle" : "Yeni not"}
                  </label>
                  {editingNote && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        resetEditor();
                        editorRef.current?.focus();
                      }}
                      className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Düzenlemekten vazgeç
                    </button>
                  )}
                </div>
                <textarea
                  ref={editorRef}
                  id="supplier-note-content"
                  required
                  maxLength={10000}
                  rows={5}
                  value={content}
                  disabled={isPending}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Firma için notunuzu buraya yazın…"
                  style={ruledPaper}
                  className="block min-h-40 w-full resize-y rounded-none border-0 bg-transparent p-0 text-base leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{content.length} / 10.000 karakter</span>
                  <button
                    type="submit"
                    disabled={isPending || !content.trim()}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {saveMutation.isPending
                      ? "Kaydediliyor…"
                      : editingNote
                        ? "Değişiklikleri Kaydet"
                        : "Notu Kaydet"}
                  </button>
                </div>
              </form>

              <div className="mb-4 flex items-center justify-between border-t border-[#e5dcc8] pt-4">
                <h3 className="text-sm font-bold">Kayıtlı notlar</h3>
                <span className="text-xs text-slate-500">{notes.length} not</span>
              </div>
              {notesQuery.isLoading && (
                <p role="status" className="py-8 text-center text-sm text-slate-500">
                  Notlar yükleniyor…
                </p>
              )}
              {notesQuery.isError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">
                    {notesQuery.error instanceof Error
                      ? notesQuery.error.message
                      : "Firma notları alınamadı"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void notesQuery.refetch()}
                    className="mt-2 rounded px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    Tekrar dene
                  </button>
                </div>
              )}
              {!notesQuery.isLoading && !notesQuery.isError && notes.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Bu firmanın henüz notu yok. İlk notunuzu yukarıya yazın.
                </p>
              )}
              <div className="space-y-6">
                {notes.map((savedNote) => (
                  <article key={savedNote.id} className="border-b border-[#e5dcc8] pb-5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-500">
                        <time dateTime={savedNote.createdAt}>
                          {formatNoteDate(savedNote.createdAt)}
                        </time>
                        {savedNote.updatedAt !== savedNote.createdAt && (
                          <span className="mt-1 block">
                            Düzenlendi: {formatNoteDate(savedNote.updatedAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setEditingNote(savedNote);
                            setContent(savedNote.content);
                            editorRef.current?.focus();
                            editorRef.current?.scrollIntoView({
                              block: "center",
                              behavior: "smooth",
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Düzenle
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setDeleteTarget(savedNote)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Sil
                        </button>
                      </div>
                    </div>
                    <p
                      style={ruledPaper}
                      className="min-h-8 whitespace-pre-wrap break-words text-base leading-8 text-slate-800 [overflow-wrap:anywhere]"
                    >
                      {savedNote.content}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => !nextOpen && !deleteMutation.isPending && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notu sil</AlertDialogTitle>
            <AlertDialogDescription>
              {supplierName} firmasına ait bu not kalıcı olarak silinecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteTarget || deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Siliniyor…" : "Evet, Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
