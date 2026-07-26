import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, ChevronRight, Plus } from "lucide-react";
import { clientsListQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — DarziYaar" },
      { name: "description", content: "Your client list and their job card history." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useQuery(clientsListQuery);
  const [q, setQ] = useState("");
  const filtered = (clients ?? []).filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <AppShell title="Clients">
      <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className="pl-10 h-12" />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 w-1/3 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center">
            <div className="grid h-14 w-14 mx-auto place-items-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {q ? "No matches" : "No clients yet"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {q ? "Try a different name." : "Clients are added when you create their first job card."}
            </p>
            {!q && (
              <Button size="lg" onClick={() => navigate({ to: "/job-cards/new" })} className="mt-6 h-12">
                <Plus className="h-5 w-5 mr-2" /> New job card
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <Link key={c.id} to="/clients/$id" params={{ id: c.id }}>
                <Card className="p-4 flex items-center gap-3 hover:border-primary/50 transition">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.card_count} {c.card_count === 1 ? "job card" : "job cards"}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
