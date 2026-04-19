"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../theme";

type Tab = "emoji" | "gifs" | "stickers";

type GiphyItem = {
  id: string;
  title: string;
  preview: string;
  full: string;
  width: number;
  height: number;
};

type EmojiEntry = { char: string; keywords: string };

const EMOJI: EmojiEntry[] = [
  { char: "😀", keywords: "grinning face smile happy" },
  { char: "😃", keywords: "grinning big eyes smile happy" },
  { char: "😄", keywords: "grinning smiling eyes smile happy" },
  { char: "😁", keywords: "beaming smile grin happy" },
  { char: "😆", keywords: "laughing grin smile happy" },
  { char: "😅", keywords: "sweat smile grinning relieved" },
  { char: "🤣", keywords: "rofl laughing floor rolling laugh" },
  { char: "😂", keywords: "joy tears laugh crying happy" },
  { char: "🙂", keywords: "slight smile happy" },
  { char: "🙃", keywords: "upside down silly" },
  { char: "😉", keywords: "wink flirt playful" },
  { char: "😊", keywords: "blush smile happy" },
  { char: "😇", keywords: "innocent angel halo" },
  { char: "🥰", keywords: "love hearts smile in-love" },
  { char: "😍", keywords: "heart eyes love in-love" },
  { char: "🤩", keywords: "star struck amazed stars" },
  { char: "😘", keywords: "kiss blow kissing" },
  { char: "😗", keywords: "kiss kissing" },
  { char: "☺️", keywords: "smiling relaxed blush" },
  { char: "😚", keywords: "kiss closed eyes" },
  { char: "😙", keywords: "kiss smiling eyes" },
  { char: "🥲", keywords: "smile tear happy sad" },
  { char: "😋", keywords: "yum savor food tongue" },
  { char: "😛", keywords: "tongue out playful" },
  { char: "😜", keywords: "wink tongue out silly" },
  { char: "🤪", keywords: "zany crazy wild silly" },
  { char: "😝", keywords: "tongue out closed eyes playful" },
  { char: "🤑", keywords: "money face rich" },
  { char: "🤗", keywords: "hug hugging open arms" },
  { char: "🤭", keywords: "oops shushing hand mouth" },
  { char: "🤫", keywords: "shush quiet secret" },
  { char: "🤔", keywords: "thinking hmm pondering" },
  { char: "🤐", keywords: "zipper mouth quiet secret" },
  { char: "🤨", keywords: "eyebrow skeptical suspicious" },
  { char: "😐", keywords: "neutral face" },
  { char: "😑", keywords: "expressionless blank" },
  { char: "😶", keywords: "no mouth silent speechless" },
  { char: "😏", keywords: "smirk smug flirt" },
  { char: "😒", keywords: "unamused meh annoyed" },
  { char: "🙄", keywords: "eye roll annoyed" },
  { char: "😬", keywords: "grimace awkward" },
  { char: "🤥", keywords: "lying pinocchio liar" },
  { char: "😌", keywords: "relieved calm" },
  { char: "😔", keywords: "pensive sad disappointed" },
  { char: "😪", keywords: "sleepy tired" },
  { char: "🤤", keywords: "drool" },
  { char: "😴", keywords: "sleeping zzz tired" },
  { char: "😷", keywords: "mask sick medical" },
  { char: "🤒", keywords: "sick thermometer ill" },
  { char: "🤕", keywords: "head bandage injured" },
  { char: "🤢", keywords: "nauseated sick green" },
  { char: "🤮", keywords: "vomit throwing up sick" },
  { char: "🤧", keywords: "sneezing sick" },
  { char: "🥵", keywords: "hot heat sweating" },
  { char: "🥶", keywords: "cold freezing" },
  { char: "🥴", keywords: "woozy dizzy drunk" },
  { char: "😵", keywords: "dizzy knocked out" },
  { char: "🤯", keywords: "mind blown exploding head" },
  { char: "🤠", keywords: "cowboy hat" },
  { char: "🥳", keywords: "party hat celebration" },
  { char: "🥸", keywords: "disguise glasses" },
  { char: "😎", keywords: "cool sunglasses" },
  { char: "🤓", keywords: "nerd glasses" },
  { char: "🧐", keywords: "monocle inspect" },
  { char: "😕", keywords: "confused" },
  { char: "😟", keywords: "worried concerned" },
  { char: "🙁", keywords: "frown slight sad" },
  { char: "☹️", keywords: "frowning sad" },
  { char: "😮", keywords: "open mouth surprised wow" },
  { char: "😯", keywords: "hushed surprised" },
  { char: "😲", keywords: "astonished shocked" },
  { char: "😳", keywords: "flushed embarrassed" },
  { char: "🥺", keywords: "pleading puppy eyes begging" },
  { char: "😦", keywords: "frowning open mouth" },
  { char: "😧", keywords: "anguished" },
  { char: "😨", keywords: "fearful scared" },
  { char: "😰", keywords: "anxious sweat worried" },
  { char: "😥", keywords: "sad relieved" },
  { char: "😢", keywords: "crying tear sad" },
  { char: "😭", keywords: "sobbing crying sad tears" },
  { char: "😱", keywords: "scream shock terrified" },
  { char: "😖", keywords: "confounded" },
  { char: "😣", keywords: "persevere" },
  { char: "😞", keywords: "disappointed sad" },
  { char: "😓", keywords: "sweat downcast" },
  { char: "😩", keywords: "weary tired" },
  { char: "😫", keywords: "tired exhausted" },
  { char: "🥱", keywords: "yawn tired" },
  { char: "😤", keywords: "triumph frustrated steam" },
  { char: "😡", keywords: "angry mad red" },
  { char: "😠", keywords: "angry mad" },
  { char: "🤬", keywords: "cursing swearing angry" },
  { char: "😈", keywords: "devil smiling purple" },
  { char: "👿", keywords: "angry devil imp" },
  { char: "💀", keywords: "skull death" },
  { char: "☠️", keywords: "skull crossbones danger poison" },
  { char: "💩", keywords: "poop" },
  { char: "🤡", keywords: "clown" },
  { char: "👹", keywords: "ogre monster" },
  { char: "👺", keywords: "goblin" },
  { char: "👻", keywords: "ghost boo" },
  { char: "👽", keywords: "alien ufo" },
  { char: "👾", keywords: "space invader alien game" },
  { char: "🤖", keywords: "robot bot" },
  { char: "🎃", keywords: "pumpkin halloween jack-o-lantern" },
  { char: "😺", keywords: "cat smile" },
  { char: "😸", keywords: "cat grinning" },
  { char: "😹", keywords: "cat joy tears laugh" },
  { char: "😻", keywords: "cat heart eyes love" },
  { char: "😼", keywords: "cat smirk" },
  { char: "😽", keywords: "cat kiss" },
  { char: "🙀", keywords: "cat scream" },
  { char: "😿", keywords: "cat crying sad" },
  { char: "😾", keywords: "cat pouting angry" },
  { char: "❤️", keywords: "red heart love" },
  { char: "🧡", keywords: "orange heart love" },
  { char: "💛", keywords: "yellow heart love" },
  { char: "💚", keywords: "green heart love" },
  { char: "💙", keywords: "blue heart love" },
  { char: "💜", keywords: "purple heart love" },
  { char: "🤎", keywords: "brown heart love" },
  { char: "🖤", keywords: "black heart" },
  { char: "🤍", keywords: "white heart" },
  { char: "💔", keywords: "broken heart" },
  { char: "❣️", keywords: "heart exclamation" },
  { char: "💕", keywords: "two hearts love" },
  { char: "💞", keywords: "revolving hearts love" },
  { char: "💓", keywords: "beating heart love" },
  { char: "💗", keywords: "growing heart love" },
  { char: "💖", keywords: "sparkling heart love" },
  { char: "💘", keywords: "heart arrow love cupid" },
  { char: "💝", keywords: "heart ribbon gift love" },
  { char: "💟", keywords: "heart decoration" },
  { char: "🔥", keywords: "fire flame hot" },
  { char: "✨", keywords: "sparkles shine magic" },
  { char: "🌟", keywords: "glowing star shine" },
  { char: "⭐", keywords: "star" },
  { char: "☄️", keywords: "comet" },
  { char: "💥", keywords: "boom explosion collision" },
  { char: "💫", keywords: "dizzy star" },
  { char: "👍", keywords: "thumbs up yes ok approve" },
  { char: "👎", keywords: "thumbs down no disapprove" },
  { char: "👏", keywords: "clap applause" },
  { char: "🙌", keywords: "raised hands celebrate" },
  { char: "👐", keywords: "open hands" },
  { char: "🤲", keywords: "palms up" },
  { char: "🤝", keywords: "handshake deal" },
  { char: "🙏", keywords: "pray please thanks" },
  { char: "✌️", keywords: "peace victory" },
  { char: "🤞", keywords: "fingers crossed luck" },
  { char: "🤟", keywords: "love you hand" },
  { char: "🤘", keywords: "rock on horns" },
  { char: "🤙", keywords: "call me shaka" },
  { char: "👈", keywords: "point left" },
  { char: "👉", keywords: "point right" },
  { char: "👆", keywords: "point up" },
  { char: "🖕", keywords: "middle finger" },
  { char: "👇", keywords: "point down" },
  { char: "☝️", keywords: "point up index" },
  { char: "👋", keywords: "wave hi hello bye" },
];

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 300;
`;

const Panel = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: 340px;
  height: 380px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 12px 34px rgba(0,0,0,0.46);
  overflow: hidden;
  z-index: 301;
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0.4rem;
  background: var(--t-inputBg);
  border-bottom: 1px solid var(--t-border);
  flex-shrink: 0;
`;

const TabBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 0.3rem 0.5rem;
  border: none;
  border-radius: 6px;
  background: ${(p) => (p.$active ? `rgba(${rgb.green}, 0.16)` : "transparent")};
  color: ${(p) => (p.$active ? colors.green : "var(--t-textMuted)")};
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;

  &:hover { background: rgba(${rgb.green}, 0.1); color: ${colors.green}; }
`;

const SearchRow = styled.div`
  padding: 0.4rem;
  border-bottom: 1px solid var(--t-border);
  flex-shrink: 0;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.35rem 0.55rem;
  font-size: 0.75rem;
  border-radius: 6px;
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  color: var(--t-text);
  outline: none;

  &:focus { border-color: rgba(${rgb.green}, 0.5); }
`;

const Scroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(${rgb.green}, 0.4) transparent;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(${rgb.green}, 0.4); border-radius: 3px; }
`;

const EmojiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.2rem;
`;

const EmojiBtn = styled.button`
  aspect-ratio: 1;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 1.15rem;
  cursor: pointer;
  line-height: 1;
  transition: background 0.1s;

  &:hover { background: rgba(${rgb.green}, 0.14); }
`;

const GifGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
`;

const GifCell = styled.button`
  position: relative;
  width: 100%;
  height: 100px;
  border: 1px solid var(--t-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--t-inputBg);
  cursor: pointer;
  padding: 0;
  transition: border-color 0.12s, transform 0.12s;

  &:hover {
    border-color: rgba(${rgb.green}, 0.6);
    transform: translateY(-1px);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const EndSentinel = styled.div`
  padding: 0.75rem 0;
  text-align: center;
  font-size: 0.625rem;
  color: var(--t-textGhost);
`;

type Props = {
  onEmoji: (e: string) => void;
  onGif: (url: string) => void;
  onSticker: (url: string) => void;
  onClose: () => void;
};

export default function ChatPicker({ onEmoji, onGif, onSticker, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("emoji");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (reset: boolean) => {
    if (tab === "emoji") return;
    if (loading) return;
    if (!reset && !hasMore) return;
    setLoading(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        kind: tab,
        offset: String(nextOffset),
        limit: "24",
      });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/chat/giphy?${params}`);
      const data = await res.json();
      const fresh: GiphyItem[] = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => (reset ? fresh : [...prev, ...fresh]));
      setOffset(data?.nextOffset ?? (nextOffset + fresh.length));
      setHasMore(Boolean(data?.hasMore));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [tab, query, offset, hasMore, loading]);

  useEffect(() => {
    if (tab === "emoji") return;
    setItems([]);
    setOffset(0);
    setHasMore(true);
    fetchPage(true);
  }, [tab, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "emoji") return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loading) fetchPage(false);
    }, { root: scrollRef.current, rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [tab, hasMore, loading, fetchPage]);

  const handlePick = (item: GiphyItem) => {
    if (tab === "gifs") onGif(item.full);
    else if (tab === "stickers") onSticker(item.full);
    onClose();
  };

  return (
    <>
      <Backdrop onClick={onClose} />
      <Panel onClick={(e) => e.stopPropagation()}>
        <Tabs>
          <TabBtn $active={tab === "emoji"} onClick={() => setTab("emoji")}>Emoji</TabBtn>
          <TabBtn $active={tab === "gifs"} onClick={() => setTab("gifs")}>GIFs</TabBtn>
          <TabBtn $active={tab === "stickers"} onClick={() => setTab("stickers")}>Stickers</TabBtn>
        </Tabs>

        <SearchRow>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab}…`}
            title={`Search ${tab}`}
          />
        </SearchRow>

        <Scroll ref={scrollRef}>
          {tab === "emoji" && (() => {
            const q = query.trim().toLowerCase();
            const filtered = q
              ? EMOJI.filter((e) => e.keywords.includes(q) || e.char === q)
              : EMOJI;
            return filtered.length === 0 ? (
              <EndSentinel>No emoji match &ldquo;{query}&rdquo;</EndSentinel>
            ) : (
              <EmojiGrid>
                {filtered.map((e, i) => (
                  <EmojiBtn
                    key={`${e.char}-${i}`}
                    title={e.keywords.split(" ")[0]}
                    onClick={() => { onEmoji(e.char); onClose(); }}
                  >
                    {e.char}
                  </EmojiBtn>
                ))}
              </EmojiGrid>
            );
          })()}

          {tab !== "emoji" && (
            <>
              <GifGrid>
                {items.map((it) => (
                  <GifCell key={it.id} onClick={() => handlePick(it)} title={it.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.preview} alt={it.title} loading="lazy" />
                  </GifCell>
                ))}
              </GifGrid>
              <EndSentinel ref={sentinelRef}>
                {loading ? "Loading…" : hasMore ? "Scroll for more" : items.length ? "End" : "No results"}
              </EndSentinel>
            </>
          )}
        </Scroll>
      </Panel>
    </>
  );
}
