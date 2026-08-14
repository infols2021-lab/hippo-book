import { TourProvider } from "@/components/tour/TourProvider";
import "@/app/(app)/projects/[slug]/assignment/assignment.css";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TourProvider initialStage="finished">{children}</TourProvider>;
}
