import dynamic from "next/dynamic";
import { PageSkeleton } from "../components/skeleton";

export const metadata = {
  title: "Agents",
};

const AgentsBoard = dynamic(
  () => import("../components/agents-board").then((mod) => ({ default: mod.AgentsBoard })),
  { loading: () => <PageSkeleton /> },
);

export default function AgentsPage() {
  return <AgentsBoard />;
}
