// app/(app)/projects/[slug]/rewards/RewardsPage.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RewardsModal from "@/components/rewards/RewardsModal";
import { dispatchTourPageReady } from "@/lib/tour/tourMobile";
import { useTour } from "@/components/tour/TourProvider";

type InitialTab = "wardrobe" | "streaks" | "promocode" | "referrals" | "timeline" | undefined;

export default function RewardsPage({
  projectSlug,
  initialTab,
}: {
  projectSlug: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const { stage } = useTour();

  useEffect(() => {
    dispatchTourPageReady();
  }, []);

  const initialTabNormalized: InitialTab = (() => {
    const raw = initialTab;
    if (!raw) return "wardrobe";
    if (raw === "streaks" || raw === "promocode" || raw === "referrals" || raw === "timeline") {
      return raw as InitialTab;
    }
    return "wardrobe";
  })();

  return (
    <div className="w-full h-dvh flex flex-col" data-tour="rewards-page">
      <RewardsModal
        isOpen={true}
        initialTab={initialTabNormalized}
        tourMode={stage === "rewards_tour"}
        variant="page"
        title="Центр наград"
        onClose={() => {
          router.push(`/projects/${projectSlug}/profile`);
        }}
      />
    </div>
  );
}
