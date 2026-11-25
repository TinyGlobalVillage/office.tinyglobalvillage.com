// heic-decode ships no types. Only the default export is used (src/lib/storage/deps.ts, via createSharpTransform).
declare module "heic-decode" {
  const decode: (input: { buffer: ArrayBufferLike | Uint8Array }) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
  export default decode;
}
