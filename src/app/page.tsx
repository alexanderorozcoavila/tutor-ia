import { TutorMain } from "@/components/TutorMain";
import { FullScreenWrapper } from "@/components/FullScreenWrapper";

export default function Home() {
  return (
    <FullScreenWrapper>
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <TutorMain />
      </main>
    </FullScreenWrapper>
  );
}
