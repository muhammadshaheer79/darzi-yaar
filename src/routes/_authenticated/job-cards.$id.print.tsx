import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { jobCardDetailQuery, garmentTypesQuery } from "@/lib/queries";
import { format } from "date-fns";
import { Printer, ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/job-cards/$id/print")({
  head: () => ({
    meta: [
      { title: "Print Job Card — DarziYaar" },
      { name: "description", content: "Printable job card view." },
    ],
  }),
  component: PrintView,
});

function PrintView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useQuery(jobCardDetailQuery(id));
  const { data: garmentTypes } = useQuery(garmentTypesQuery);
  const garment = data?.card?.garment_types
    ? garmentTypes?.find((g) => g.id === data.card.garment_types!.id) ?? null
    : null;

  useEffect(() => {
    // Auto-open print dialog after data is loaded
    if (data?.card && garment) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [data, garment]);

  if (!data?.card || !garment) {
    return <div className="p-8 text-center">Loading…</div>;
  }

  const notes = data.values.find((x) => x.field_key === "notes")?.value;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="no-print sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/job-cards/$id", params: { id } })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1.5" /> Print
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-8 sm:p-10 print:p-6">
        <div className="text-center border-b-2 border-black pb-4">
          <div className="text-xs uppercase tracking-widest text-gray-600">DarziYaar Job Card</div>
          <h1 className="text-3xl font-bold mt-2">{data.card.clients?.name}</h1>
          <div className="text-lg mt-1">{data.card.garment_types?.name}</div>
          {data.card.clients?.phone && <div className="text-sm text-gray-600 mt-1">{data.card.clients.phone}</div>}
        </div>

        <table className="w-full mt-6 border-collapse">
          <tbody>
            {garment.fields.filter((f) => !f.is_notes).map((f) => {
              const v = data.values.find((x) => x.field_key === f.field_key);
              return (
                <tr key={f.field_key} className="border-b border-gray-300">
                  <td className="py-3 pr-4 font-medium">{f.field_label}</td>
                  <td className="py-3 text-right font-mono text-lg font-bold">
                    {v?.value ? `${v.value}${f.unit ? " " + f.unit : ""}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {notes && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-widest text-gray-600 mb-1">Notes</div>
            <div className="border border-gray-400 rounded p-3 whitespace-pre-wrap text-sm">{notes}</div>
          </div>
        )}

        <div className="text-xs text-gray-500 mt-8 pt-4 border-t border-gray-300 flex justify-between">
          <span>Created {format(new Date(data.card.created_at), "PPP")}</span>
          <span>DarziYaar</span>
        </div>
      </div>
    </div>
  );
}
