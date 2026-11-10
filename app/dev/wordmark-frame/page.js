import { notFound } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { devPreviewBlocked } from "@/lib/dev-preview";

export const dynamic = "force-dynamic";

export default function WordmarkFrame() {
  if (devPreviewBlocked()) notFound();
  return (
    <div className="wordmark-frame" id="wordmark-frame">
      <Wordmark heading={false} />
    </div>
  );
}
