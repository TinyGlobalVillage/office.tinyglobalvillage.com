"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatDrawer from "../../components/ChatDrawer";

function ChatPopoutInner() {
  const searchParams = useSearchParams();
  const peer = searchParams?.get("peer") ?? null;
  const group = searchParams?.get("group") ?? null;
  return <ChatDrawer popout popoutPeer={peer} popoutGroup={group} />;
}

export default function ChatPopoutPage() {
  return (
    <Suspense fallback={null}>
      <ChatPopoutInner />
    </Suspense>
  );
}
