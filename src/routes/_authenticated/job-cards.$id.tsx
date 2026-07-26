import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { jobCardDetailQuery, garmentTypesQuery, type GarmentField } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Printer, Share2, Edit3, Save, X, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/job-cards/$id")({
  head: () => ({
    meta: [
      { title: "Job Card — DarziYaar" },
      { name: "description", content: "View and edit a job card." },
    ],
  }),
  component: JobCardDetail,
});

function JobCardDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(jobCardDetailQuery(id));
  const { data: garmentTypes } = useQuery(garmentTypesQuery);

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const garment = data?.card?.garment_types
    ? garmentTypes?.find((g) => g.id === data.card.garment_types!.id) ?? null
    : null;

  function startEdit() {
    if (!data?.card || !garment) return;
    const init: Record<string, string> = {};
    for (const f of garment.fields) {
      const found = data.values.find((v) => v.field_key === f.field_key);
      init[f.field_key] = found?.value ?? "";
    }
    setValues(init);
    setEditing(true);
  }

  async function save() {
    if (!garment) return;
    // Validate ranges
    for (const f of garment.fields) {
      if (f.is_notes) continue;
      const raw = values[f.field_key]?.trim();
      if (!raw) continue;
      const num = Number(raw);
      if (!Number.isFinite(num)) { toast.error(`${f.field_label} must be a number`); return; }
      const min = f.min_value ?? 0;
      const max = f.max_value ?? 999;
      if (num < min || num > max) { toast.error(`${f.field_label}: this doesn't look right — please check.`); return; }
    }
    setSaving(true);
    try {
      // Delete existing and reinsert (simple + safe)
      await supabase.from("job_card_values").delete().eq("job_card_id", id);
      const rows = garment.fields
        .filter((f) => values[f.field_key]?.trim().length > 0)
        .map((f) => ({ job_card_id: id, field_key: f.field_key, value: values[f.field_key].trim(), confidence: null }));
      if (rows.length > 0) {
        const { error: vErr } = await supabase.from("job_card_values").insert(rows);
        if (vErr) throw vErr;
      }
      await supabase.from("job_cards").update({ status: "confirmed" }).eq("id", id);
      qc.invalidateQueries();
      setEditing(false);
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm("Delete this job card? This cannot be undone.")) return;
    const { error } = await supabase.from("job_cards").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
    toast.success("Deleted");
    navigate({ to: "/home" });
  }

  function share() {
    if (!data?.card || !garment) return;
    const lines = [
      `*${data.card.clients?.name ?? "Client"}* — ${data.card.garment_types?.name ?? "Garment"}`,
      "",
      ...garment.fields
        .filter((f) => !f.is_notes)
        .map((f) => {
          const v = data.values.find((x) => x.field_key === f.field_key)?.value;
          return v ? `${f.field_label}: ${v}${f.unit ? " " + f.unit : ""}` : null;
        })
        .filter(Boolean),
    ];
    const notes = data.values.find((x) => x.field_key === "notes")?.value;
    if (notes) { lines.push("", `Notes: ${notes}`); }
    const text = lines.join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <AppShell
      title={data?.card?.clients?.name ?? "Job Card"}
      showBack
      onBack={() => navigate({ to: "/home" })}
    >
      <div className="px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full space-y-4">
        {isLoading ? (
          <Card className="p-6 animate-pulse h-40" />
        ) : !data?.card ? (
          <Card className="p-8 text-center">Job card not found.</Card>
        ) : !garment ? (
          <Card className="p-8 text-center">
            <p>This garment type is no longer available.</p>
          </Card>
        ) : (
          <>
            <Card className="p-5 print-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">{data.card.clients?.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{data.card.garment_types?.name}</p>
                  {data.card.clients?.phone && (
                    <p className="text-xs text-muted-foreground mt-1">{data.card.clients.phone}</p>
                  )}
                </div>
                {data.card.status === "confirmed" ? (
                  <Badge className="bg-success/15 text-success border-success/30">Confirmed</Badge>
                ) : (
                  <Badge className="bg-warning-bg text-warning-foreground">Needs review</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                Created {format(new Date(data.card.created_at), "PPP")} · Updated {format(new Date(data.card.updated_at), "PP")}
              </div>
            </Card>

            <Card className="p-5 print-card">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {garment.fields.filter((f) => !f.is_notes).map((f) => (
                      <EditField key={f.field_key} field={f} value={values[f.field_key] ?? ""} onChange={(v) => setValues((p) => ({ ...p, [f.field_key]: v }))} />
                    ))}
                  </div>
                  {garment.fields.find((f) => f.is_notes) && (
                    <div>
                      <Label>Notes</Label>
                      <Textarea value={values["notes"] ?? ""} onChange={(e) => setValues((p) => ({ ...p, notes: e.target.value }))} rows={3} />
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>
                      <X className="h-4 w-4 mr-2" /> Cancel
                    </Button>
                    <Button className="flex-1" onClick={save} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {garment.fields.filter((f) => !f.is_notes).map((f) => {
                      const v = data.values.find((x) => x.field_key === f.field_key);
                      return (
                        <div key={f.field_key} className="flex justify-between items-baseline border-b border-dashed border-border pb-2">
                          <span className="text-sm text-muted-foreground">{f.field_label}</span>
                          <span className={cn("font-mono font-semibold text-base", !v && "text-muted-foreground/50")}>
                            {v?.value ? `${v.value}${f.unit ? " " + f.unit : ""}` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const notes = data.values.find((x) => x.field_key === "notes")?.value;
                    return notes ? (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</div>
                        <p className="text-sm whitespace-pre-wrap">{notes}</p>
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </Card>

            {!editing && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 no-print">
                <Button variant="outline" onClick={startEdit} className="h-11">
                  <Edit3 className="h-4 w-4 mr-1.5" /> Edit
                </Button>
                <Button variant="outline" asChild className="h-11">
                  <Link to="/job-cards/$id/print" params={{ id }}>
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                  </Link>
                </Button>
                <Button variant="outline" onClick={share} className="h-11">
                  <Share2 className="h-4 w-4 mr-1.5" /> Share
                </Button>
                <Button variant="outline" onClick={del} className="h-11 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function EditField({ field, value, onChange }: { field: GarmentField; value: string; onChange: (v: string) => void }) {
  const raw = value.trim();
  const num = raw ? Number(raw) : NaN;
  const min = field.min_value ?? 0;
  const max = field.max_value ?? 999;
  const invalid = raw.length > 0 && (!Number.isFinite(num) || num < min || num > max);
  return (
    <div>
      <Label htmlFor={field.field_key}>
        {field.field_label} {field.unit && <span className="text-muted-foreground font-normal">({field.unit})</span>}
      </Label>
      <Input
        id={field.field_key}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className={cn("h-11", invalid && "border-destructive focus-visible:ring-destructive")}
      />
      {invalid && (
        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Value out of range
        </p>
      )}
    </div>
  );
}
