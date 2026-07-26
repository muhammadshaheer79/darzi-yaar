import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Mic, FileText } from "lucide-react";
import { jobCardsListQuery } from "@/lib/queries";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your Job Cards — DarziYaar" },
      { name: "description", content: "All your client job cards in one place, most recent first." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { data: cards, isLoading } = useQuery(jobCardsListQuery);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!cards) return [];
    const s = q.trim().toLowerCase();
    if (!s) return cards;
    return cards.filter((c) => c.client?.name.toLowerCase().includes(s));
  }, [cards, q]);

  return (
    <AppShell
      title="Job Cards"
      headerRight={
        <Button size="sm" onClick={() => navigate({ to: "/job-cards/new" })} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      }
    >
      <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by client name"
            className="pl-10 h-12"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-3 w-1/3 bg-muted rounded mt-3" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={!!q.trim()} onCreate={() => navigate({ to: "/job-cards/new" })} />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((card) => (
              <Link
                key={card.id}
                to="/job-cards/$id"
                params={{ id: card.id }}
                className="block"
              >
                <Card className="p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{card.client?.name ?? "Unknown client"}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {card.garment_type?.name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <StatusBadge status={card.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Floating action button on mobile */}
      <button
        onClick={() => navigate({ to: "/job-cards/new" })}
        className="sm:hidden fixed right-4 bottom-24 z-20 h-14 pl-5 pr-6 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2 font-medium active:scale-95 transition"
        aria-label="New job card"
      >
        <Plus className="h-5 w-5" />
        <span>New</span>
      </button>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") return <Badge variant="secondary" className="bg-success/15 text-success border-success/30">Confirmed</Badge>;
  if (status === "needs_review") return <Badge variant="secondary" className="bg-warning-bg text-warning-foreground border-warning/40">Needs review</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function EmptyState({ hasQuery, onCreate }: { hasQuery: boolean; onCreate: () => void }) {
  if (hasQuery) {
    return (
      <Card className="p-8 text-center">
        <Search className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="mt-3 font-medium">No matches</p>
        <p className="text-sm text-muted-foreground mt-1">Try a different name.</p>
      </Card>
    );
  }
  return (
    <Card className="p-8 sm:p-12 text-center">
      <div className="grid h-14 w-14 mx-auto place-items-center rounded-2xl bg-primary/10 text-primary">
        <FileText className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">No job cards yet</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        Tap the button below to record your first voice note — we'll build the card for you.
      </p>
      <Button size="lg" onClick={onCreate} className="mt-6 h-12 px-6">
        <Mic className="h-5 w-5 mr-2" />
        Create your first job card
      </Button>
    </Card>
  );
}
