import { Suspense } from "react";
import { PageSkeleton } from "../components/skeleton";
import { WorkspaceBoard } from "../components/workspace-board";

export const metadata = {
  title: "Workspaces",
};

export default function WorkspacesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkspaceBoard />
    </Suspense>
  );
}
