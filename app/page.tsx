import dynamic from "next/dynamic";
import { HomeSkeleton } from "./components/skeleton";

export const metadata = {
  title: "Home",
};

const HomeBoard = dynamic(
  () => import("./components/home-board").then((mod) => ({ default: mod.HomeBoard })),
  { loading: () => <HomeSkeleton /> },
);

export default function HomePage() {
  return <HomeBoard />;
}
