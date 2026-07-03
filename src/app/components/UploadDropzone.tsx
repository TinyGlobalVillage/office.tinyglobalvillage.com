"use client";

/**
 * UploadDropzone — the Office-wide drag-and-drop upload convention
 * (operator directive 2026-07-03, modeled on the Documenso profile-photo
 * modal): soft panel, centered cloud-upload icon, bold "Drop your X here
 * to upload" headline, format hint + optional recommendation line, and a
 * white "Choose File" pill. Every drop target in Office uses this — don't
 * hand-roll new zones.
 *
 * Purely presentational + DnD/file-picker wiring; upload mechanics stay
 * with the caller (pass dynamic `headline`/`hint` while uploading, and
 * progress bars as children).
 */

import { useRef, useState, type ReactNode } from "react";
import styled from "styled-components";
import { UploadCloudIcon } from "./icons";

const Zone = styled.div<{ $dragging: boolean; $disabled: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  text-align: center;
  padding: 2.25rem 1.5rem;
  border-radius: 0.75rem;
  border: 1.5px ${(p) => (p.$dragging ? "dashed" : "solid")} ${(p) => (p.$dragging ? "rgba(120,200,255,0.8)" : "var(--t-border)")};
  background: ${(p) => (p.$dragging ? "rgba(120,200,255,0.08)" : "rgba(255,255,255,0.04)")};
  color: var(--t-textFaint);
  cursor: ${(p) => (p.$disabled ? "default" : "pointer")};
  opacity: ${(p) => (p.$disabled ? 0.65 : 1)};
  transition: background 0.15s ease, border-color 0.15s ease;
`;

const Headline = styled.div`
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--t-text);
  word-break: break-word;
`;

const Hint = styled.div`
  font-size: 0.8125rem;
  color: var(--t-textFaint);
  line-height: 1.5;
`;

const ChooseBtn = styled.button`
  margin-top: 0.6rem;
  padding: 0.6rem 1.5rem;
  border-radius: 999px;
  border: none;
  background: #ffffff;
  color: #17181c;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  &:hover:not(:disabled) { filter: brightness(0.9); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export type UploadDropzoneProps = {
  /** Bold line, e.g. `Drop your PDF here to upload` (or live progress text). */
  headline: string;
  /** Formats line, e.g. `Works with any .JPG, .PNG, or .GIF file.` */
  hint: string;
  /** Optional second hint line, e.g. `Recommended size: 300 x 300`. */
  recommendation?: string;
  /** <input accept> value. */
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  chooseLabel?: string;
  onFiles: (files: FileList) => void;
  /** Extra content below the button (progress bars etc.). */
  children?: ReactNode;
};

export default function UploadDropzone({
  headline,
  hint,
  recommendation,
  accept,
  multiple = false,
  disabled = false,
  chooseLabel = "Choose File",
  onFiles,
  children,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <Zone
      $dragging={dragging}
      $disabled={disabled}
      onClick={open}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled && e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <UploadCloudIcon size={44} />
      <Headline>{headline}</Headline>
      <Hint>
        {hint}
        {recommendation && (
          <>
            <br />
            {recommendation}
          </>
        )}
      </Hint>
      <ChooseBtn
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
      >
        {chooseLabel}
      </ChooseBtn>
      {children}
    </Zone>
  );
}
