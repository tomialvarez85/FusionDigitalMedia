export default function Skeleton({
  className = "",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`animate-pulse rounded ${
        tone === "dark" ? "bg-zinc-800" : "bg-neutral-200"
      } ${className}`}
    />
  );
}
