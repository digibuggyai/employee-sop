"use client";

import { useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Camera, LoaderCircle, Minus, Plus, Trash2 } from "lucide-react";
import { ApiError, api, type User } from "@/lib/api";
import { cropToJpeg } from "@/lib/image";
import Avatar from "./Avatar";
import { useConfirm, useToast } from "./Feedback";
import Modal from "./Modal";
import { Button } from "./form";

// Change / remove a profile photo. Used on My Profile (yourself) and in the admin's edit form.
// Choosing a photo opens a crop window (drag + zoom inside a circle); Save uploads only that part.
// onChange receives the updated user (with the new photoUpdatedAt) so the page can refresh.
export default function PhotoUploader({ user, onChange }: { user: User; onChange: (u: User) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // the photo being cropped: the file + a temporary local URL to preview it
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);

  function pick(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file (JPEG or PNG)");
    setPicked({ file, url: URL.createObjectURL(file) }); // opens the crop window
  }

  function closeCrop() {
    if (picked) URL.revokeObjectURL(picked.url); // free the memory used by the preview
    setPicked(null);
    if (input.current) input.current.value = ""; // so choosing the same file again still works
  }

  async function save(area: Area) {
    if (!picked) return;
    setBusy(true);
    try {
      const jpeg = await cropToJpeg(picked.file, area); // 256x256 JPEG of just the chosen area
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
      closeCrop();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
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
        {busy && !picked && (
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
        <p className="text-xs text-zinc-500">JPEG or PNG. You can crop it next.</p>
      </div>

      {/* accept="image/*": on phones this offers the camera or the gallery */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) pick(file);
        }}
      />

      <Modal open={!!picked} onClose={closeCrop} title="Crop your photo" description="Drag to move, pinch or use the slider to zoom.">
        {picked && <CropArea key={picked.url} url={picked.url} busy={busy} onCancel={closeCrop} onSave={save} />}
      </Modal>
    </div>
  );
}

// The crop window's contents: the photo under a round frame, a zoom slider, and the buttons.
function CropArea({
  url,
  busy,
  onCancel,
  onSave,
}: {
  url: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (area: Area) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // the chosen square in the ORIGINAL photo's pixels (react-easy-crop works it out for us)
  const [area, setArea] = useState<Area | null>(null);
  const MIN = 1;
  const MAX = 4;
  const step = (d: number) => setZoom((z) => Math.min(MAX, Math.max(MIN, +(z + d).toFixed(2))));

  return (
    <div>
      {/* the cropper fills this box; it needs a fixed height and position: relative */}
      <div className="relative h-72 overflow-hidden rounded-lg bg-zinc-900 sm:h-80">
        <Cropper
          image={url}
          crop={crop}
          zoom={zoom}
          minZoom={MIN}
          maxZoom={MAX}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
      </div>

      {/* zoom: buttons are easier to hit on phones than a thin slider alone */}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => step(-0.2)} aria-label="Zoom out" className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100">
          <Minus size={16} />
        </button>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="h-2 flex-1 cursor-pointer accent-brand-700"
        />
        <button type="button" onClick={() => step(0.2)} aria-label="Zoom in" className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100">
          <Plus size={16} />
        </button>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" loading={busy} disabled={!area} onClick={() => area && onSave(area)}>
          Save photo
        </Button>
      </div>
    </div>
  );
}
