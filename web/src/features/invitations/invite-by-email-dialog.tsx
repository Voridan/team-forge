import { useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError } from "@/api/client";
import type { TeamRole } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCreateInvitations } from "./queries";

const MAX_EMAILS_PER_BATCH = 20;
const emailSchema = z.string().email();

const ROLE_OPTIONS: { value: Exclude<TeamRole, "OWNER">; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "ADMIN", label: "Admin" },
  { value: "GUEST", label: "Guest" },
];

export function InviteByEmailDialog({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [role, setRole] = useState<Exclude<TeamRole, "OWNER">>("MEMBER");
  const createInvitations = useCreateInvitations(teamId);

  const reset = () => {
    setEmails([]);
    setDraft("");
    setDraftError(null);
    setRole("MEMBER");
  };

  const tryCommitDraft = (raw: string): boolean => {
    const candidate = raw.trim().replace(/[,;\s]+$/, "");
    if (!candidate) return true;
    const parsed = emailSchema.safeParse(candidate);
    if (!parsed.success) {
      setDraftError("Not a valid email");
      return false;
    }
    if (emails.includes(candidate)) {
      setDraftError("Already added");
      return false;
    }
    if (emails.length >= MAX_EMAILS_PER_BATCH) {
      setDraftError(`Maximum ${MAX_EMAILS_PER_BATCH} emails per invite`);
      return false;
    }
    setEmails([...emails, candidate]);
    setDraft("");
    setDraftError(null);
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      tryCommitDraft(draft);
    } else if (e.key === "Backspace" && draft === "" && emails.length > 0) {
      setEmails(emails.slice(0, -1));
    } else if (draftError) {
      setDraftError(null);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!/[,;\s]/.test(pasted)) return;
    e.preventDefault();
    const parts = pasted.split(/[,;\s]+/).filter(Boolean);
    let added = 0;
    for (const part of parts) {
      const ok = tryCommitDraft(part);
      if (ok) added += 1;
      if (!ok) break;
    }
    if (added === parts.length) setDraft("");
  };

  const submit = () => {
    // Commit any in-flight draft first so users don't lose what they typed.
    if (draft.trim() && !tryCommitDraft(draft)) return;
    const toSend = draft.trim() ? [...emails, draft.trim()] : emails;
    if (toSend.length === 0) {
      setDraftError("Add at least one email");
      return;
    }

    createInvitations.mutate(
      { emails: toSend, role },
      {
        onSuccess: ({ created, skipped }) => {
          if (created.length > 0) {
            toast.success(
              `Sent ${created.length} ${created.length === 1 ? "invitation" : "invitations"}`,
            );
          }
          for (const item of skipped) {
            toast.info(`${item.email}: ${item.reason}`);
          }
          setOpen(false);
          reset();
        },
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? (err.problem.detail ?? err.problem.title)
              : "Could not send invitations";
          toast.error(message);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail />
          Invite by email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite by email</DialogTitle>
          <DialogDescription>
            Each address will receive an invitation link. New users will be
            prompted to register; existing users to sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-emails">Emails</Label>
            <div
              className={cn(
                "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 shadow-sm",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
                draftError &&
                  "border-destructive focus-within:ring-destructive",
              )}
            >
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => setEmails(emails.filter((e) => e !== email))}
                    className="rounded text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id="invite-emails"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (draftError) setDraftError(null);
                }}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => draft.trim() && tryCommitDraft(draft)}
                placeholder={
                  emails.length === 0
                    ? "name@example.com, another@example.com"
                    : ""
                }
                className="min-w-[12ch] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            {draftError ? (
              <p className="text-xs text-destructive">{draftError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="rounded bg-secondary px-1 font-mono">↵</kbd> or
                comma to add. Backspace removes the last one.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role for new members</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as Exclude<TeamRole, "OWNER">)
              }
              className="w-full appearance-none rounded-md border bg-background px-2 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={createInvitations.isPending}
          >
            {createInvitations.isPending && (
              <Loader2 className="animate-spin" />
            )}
            Send invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
