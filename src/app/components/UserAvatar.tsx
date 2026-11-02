"use client";

import { useState } from "react";
import type { MemberProfile } from "./ChatSettingsModal";

export function UserAvatar({
  profile,
  size = 32,
}: {
  profile: Pick<MemberProfile, "displayName" | "accentColor" | "avatarUrl">;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const hasImg = profile.avatarUrl && !imgError;

  if (hasImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={profile.displayName}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `1.5px solid ${profile.accentColor}66`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${profile.accentColor}44, ${profile.accentColor}18)`,
        border: `1.5px solid ${profile.accentColor}66`,
        color: profile.accentColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {profile.displayName[0]?.toUpperCase()}
    </div>
  );
}
