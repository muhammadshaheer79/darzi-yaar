import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clientDetailQuery } from "@/lib/queries";
import { formatDistanceToNow } from "date-fns";
import { FileText, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "Client — DarziYaar" },
      { name: "description", content: "Client profile and job card history." },
    ],
  }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(clientDetailQuery(id));

  return (
    <AppShell title={data?.client?.name ?? "Client"} showBack onBack={() => navigate({ to: "/clients" })}>
      <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full space-y-4">
        {isLoading ? (
          <Card className="p-6 animate-pulse h-32" />
        ) : !data?.client ? (
          <Card className="p-8 text-center">
            <p className="font-medium">Client not found</p>
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary text-xl font-bold shrink-0">
                  {data.client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">{data.client.name}</h2>
                  {data.client.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <Phone className="h-3.5 w-3.5" />
                      {data.client.phone}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                Job cards ({data.cards.length})
              </h3>
              {data.cards.length === 0 ? (
                <Card className="p-8 text-center">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">No job cards yet for this client.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {data.cards.map((card) => (
                    <Link key={card.id} to="/job-cards/$id" params={{ id: card.id }}>
                      <Card className="p-4 hover:border-primary/50 transition">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">{card.garment_types?.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}
                            </div>
                          </div>
                          {card.status === "confirmed" ? (
                            <Badge variant="secondary" className="bg-success/15 text-success border-success/30">Confirmed</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-warning-bg text-warning-foreground">Needs review</Badge>
                          )}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
