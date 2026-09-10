import dynamic from "next/dynamic";
import { PageSkeleton } from "../components/skeleton";

export const metadata = {
  title: "Settings",
};

const SettingsBoard = dynamic(
  () => import("../components/settings-board").then((mod) => ({ default: mod.SettingsBoard })),
  { loading: () => <PageSkeleton /> },
);

export default function SettingsPage() {
  return <SettingsBoard />;
}
