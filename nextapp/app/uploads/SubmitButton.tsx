"use client";

type Props = {
  loading: boolean;
  className?: string;
};

export default function SubmitButton({ loading, className }: Props) {
  return (
    <button type="submit" className={className} disabled={loading}>
      {loading ? "Generating..." : "Upload"}
    </button>
  );
}
