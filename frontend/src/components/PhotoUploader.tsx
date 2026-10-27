"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { ApiError, api, type User } from "@/lib/api";
import { toSquareJpeg } from "@/lib/image";
import Avatar from "./Avatar";
import { useConfirm, useToast } from "./Feedback";
import { Button } from "./form";

// Change / remove a profile photo. Used on My Profile (yourself) and in the admin's edit form.
// onChange receives the updated user (with the new photoUpdatedAt) so the page can refresh.
export default function PhotoUploader({ user, onChange }: { user: User; onChange: (u: User) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const jpeg = await toSquareJpeg(file); // shrink in the browser first: fast on mobile data
      // raw image bytes, not JSON, so plain fetch instead of api()
      const res = await fetch(`/api/photos/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: jpeg,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data.error ?? "Upload failed", res.status);
      onChange(data as User);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // so choosing the same file again still triggers
    }
  }

  async function remove() {
    if (!(await confirm({ title: "Remove the photo?", description: "Initials will show instead.", confirmLabel: "Remove", danger: true })))
      return;
    setBusy(true);
    try {
      onChange(await api<User>(`/api/photos/${user.id}`, { method: "DELETE" }));
      toast.success("Photo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* The photo itself is a button: tap it to choose a new one */}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Change photo"
        className="group relative shrink-0 rounded-full"
      >
        <Avatar person={user} size="xl" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          <Camera size={22} />
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
            <LoaderCircle className="animate-spin text-zinc-600" size={22} />
          </span>
        )}
        {/* small camera badge, always visible: tells phone users it's tappable */}
        <span className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full border-2 border-white bg-brand-700 text-white">
          <Camera size={13} />
        </span>
      </button>

      <div className="flex flex-col items-start gap-1.5">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <Camera size={14} /> {user.photoUpdatedAt ? "Change photo" : "Add photo"}
        </Button>
        {user.photoUpdatedAt && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove} className="text-zinc-500">
            <Trash2 size={14} /> Remove
          </Button>
        )}
        <p className="text-xs text-zinc-500">JPEG or PNG. It&apos;s cropped to a square.</p>
      </div>

      {/* accept="image/*": on phones this offers the camera or the gallery */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
    </div>
  );
}
