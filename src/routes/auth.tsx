import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");
const phoneSchema = z.string().trim().min(7, "Enter a phone number").max(20);
const nameSchema = z.string().trim().min(1, "Enter your name").max(60);
const otpSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — DarziYaar" },
      { name: "description", content: "Sign in to DarziYaar with a one-time email code." },
      { property: "og:title", content: "Sign in — DarziYaar" },
      { property: "og:description", content: "Sign in to DarziYaar with a one-time email code." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Step = "form" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedEmail = emailSchema.parse(email);
      const meta: Record<string, string> = {};
      if (mode === "signup") {
        meta.display_name = nameSchema.parse(name);
        meta.phone = phoneSchema.parse(phone);
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: parsedEmail,
        options: {
          shouldCreateUser: mode === "signup",
          data: meta,
        },
      });
      if (error) throw error;
      setStep("otp");
      toast.success("We sent a 6-digit code to your email");
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedCode = otpSchema.parse(code);
      const { error } = await supabase.auth.verifyOtp({
        email: emailSchema.parse(email),
        token: parsedCode,
        type: "email",
      });
      if (error) {
        if (error.message.toLowerCase().includes("expired")) {
          toast.error("That code has expired — request a new one");
        } else {
          toast.error("Invalid code — please check and try again");
        }
        return;
      }
      // If signup, upsert profile so name/phone are set even if the trigger raced.
      if (mode === "signup") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").upsert({ id: user.id, display_name: name.trim(), phone: phone.trim() });
        }
      }
      toast.success("Welcome!");
      navigate({ to: "/home" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 justify-center mb-6">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-none">DarziYaar</h1>
              <p className="text-xs text-muted-foreground mt-1">Voice-first job cards</p>
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            {step === "form" ? (
              <>
                <div className="flex rounded-lg bg-muted p-1 mb-6">
                  <button
                    type="button"
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setMode("signup")}
                  >
                    Create account
                  </button>
                </div>

                <form onSubmit={sendCode} className="space-y-4">
                  {mode === "signup" && (
                    <>
                      <div>
                        <Label htmlFor="name">Your name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ustaad Ahmed" autoComplete="name" required />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone number</Label>
                        <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" autoComplete="tel" required />
                      </div>
                    </>
                  )}
                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <Input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
                  </div>
                  <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                    {loading ? "Sending…" : "Send code"}
                  </Button>
                </form>
              </>
            ) : (
              <form onSubmit={verifyCode} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Enter your code</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a 6-digit code to <span className="font-medium">{email}</span>.
                  </p>
                </div>
                <div>
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                    autoFocus
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? "Verifying…" : "Verify & continue"}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep("form"); setCode(""); }}>
                    ← Change email
                  </button>
                  <button type="button" className="text-primary font-medium" onClick={(e) => sendCode(e as unknown as React.FormEvent)} disabled={loading}>
                    Resend code
                  </button>
                </div>
              </form>
            )}
          </Card>
          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing you agree to keep client measurements safe. No passwords, no SMS — just a code to your email.
          </p>
        </div>
      </div>
    </div>
  );
}
