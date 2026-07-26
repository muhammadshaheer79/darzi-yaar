import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GarmentField {
  id: string;
  field_key: string;
  field_label: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  display_order: number;
  is_notes: boolean;
}

export interface GarmentType {
  id: string;
  slug: string;
  name: string;
  display_order: number;
  fields: GarmentField[];
}

export const garmentTypesQuery = queryOptions({
  queryKey: ["garment_types"],
  queryFn: async (): Promise<GarmentType[]> => {
    const { data, error } = await supabase
      .from("garment_types")
      .select("id, slug, name, display_order, garment_fields(id, field_key, field_label, unit, min_value, max_value, display_order, is_notes)")
      .eq("is_active", true)
      .order("display_order");
    if (error) throw error;
    return (data ?? []).map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      display_order: g.display_order,
      fields: [...(g.garment_fields ?? [])].sort((a, b) => a.display_order - b.display_order),
    }));
  },
  staleTime: 5 * 60 * 1000,
});

export interface JobCardListItem {
  id: string;
  status: string;
  created_at: string;
  client: { id: string; name: string } | null;
  garment_type: { id: string; name: string; slug: string } | null;
}

export const jobCardsListQuery = queryOptions({
  queryKey: ["job_cards", "list"],
  queryFn: async (): Promise<JobCardListItem[]> => {
    const { data, error } = await supabase
      .from("job_cards")
      .select("id, status, created_at, clients(id, name), garment_types(id, name, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      client: r.clients ? { id: r.clients.id, name: r.clients.name } : null,
      garment_type: r.garment_types ? { id: r.garment_types.id, name: r.garment_types.name, slug: r.garment_types.slug } : null,
    }));
  },
});

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
  card_count: number;
}

export const clientsListQuery = queryOptions({
  queryKey: ["clients", "list"],
  queryFn: async (): Promise<ClientRow[]> => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, created_at, job_cards(count)")
      .order("name");
    if (error) throw error;
    return (data ?? []).map((c) => {
      const first = (c.job_cards as unknown as Array<{ count: number }>)?.[0];
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        created_at: c.created_at,
        card_count: first?.count ?? 0,
      };
    });
  },
});

export function jobCardDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["job_cards", "detail", id],
    queryFn: async () => {
      const { data: card, error } = await supabase
        .from("job_cards")
        .select("id, status, created_at, updated_at, notes, clients(id, name, phone), garment_types(id, name, slug)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!card) return null;
      const { data: values, error: vErr } = await supabase
        .from("job_card_values")
        .select("field_key, value, confidence")
        .eq("job_card_id", id);
      if (vErr) throw vErr;
      return { card, values: values ?? [] };
    },
  });
}

export function clientDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["clients", "detail", id],
    queryFn: async () => {
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, name, phone, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!client) return null;
      const { data: cards, error: cErr } = await supabase
        .from("job_cards")
        .select("id, status, created_at, garment_types(name, slug)")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (cErr) throw cErr;
      return { client, cards: cards ?? [] };
    },
  });
}
