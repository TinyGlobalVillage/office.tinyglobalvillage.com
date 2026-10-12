"use client";

// The chat in a window of its own: the shared messenger, already open.
import OfficeMessenger from "../../components/OfficeMessenger";

export default function ChatPopoutPage() {
  return <OfficeMessenger defaultOpen />;
}
