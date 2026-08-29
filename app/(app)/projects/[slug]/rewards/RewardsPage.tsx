// app/(app)/projects/[slug]/rewards/RewardsPage.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RewardsModal from "@/components/rewards/RewardsModal";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { dispatchTourPageReady } from "@/lib/tour/tourMobile";
import { useTour } from "@/components/tour/TourProvider";

type InitialTab = "wardrobe" | "streaks" | "promocode" | "referrals" | "timeline" | undefined;

export default function RewardsPage({
  projectSlug,
  projectName,
  markText,
  initialTab,
}: {
  projectSlug: string;
  projectName: string;
  markText: string;
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
      <div style={{ width: "95%", maxWidth: 1100, margin: "0 auto", paddingTop: 24 }}>
        <ProjectHeader
          slug={projectSlug}
          projectName={projectName}
          markText={markText}
          subtitle="Награды"
        />
      </div>
      <div className="w-full flex-1 min-h-0 flex flex-col">
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
    </div>
  );
}
