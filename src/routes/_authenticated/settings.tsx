import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Mic, Info, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DarziYaar" },
      { name: "description", content: "Your profile and account settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle();
      if (profile) {
        setName(profile.display_name ?? "");
        setPhone(profile.phone ?? "");
      }
    })();
  }, []);

  async function saveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name.trim(),
      phone: phone.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
  }

  async function signOut() {
    if (!confirm("Sign out of DarziYaar?")) return;
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell title="Settings">
      <div className="px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full space-y-5">
        <Card className="p-5">
          <h2 className="font-semibold mb-4">Your profile</h2>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={email} disabled className="h-11" />
            </div>
            <div>
              <Label htmlFor="s-name">Your name</Label>
              <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label htmlFor="s-phone">Phone number</Label>
              <Input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
            </div>
            <Button onClick={saveProfile} disabled={saving} className="w-full h-11">
              <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Mic className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Voice recordings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your voice notes are processed instantly and never stored. Only the measurements you confirm are saved. This keeps your clients' data private and your account small.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Info className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">About DarziYaar</h3>
              <p className="text-sm text-muted-foreground mt-1">
                DarziYaar turns your spoken measurements into structured job cards. Built for small tailoring shops that already work by voice.
              </p>
            </div>
          </div>
        </Card>

        <Button variant="outline" onClick={signOut} className="w-full h-11 text-destructive hover:text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </AppShell>
  );
}
