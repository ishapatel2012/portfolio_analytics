type Props = {
  onSelect: (file: File | null) => void;
  className?: string;
};

export default function FileInput({ onSelect, className }: Props) {
  return (
    <input
      type="file"
      accept=".csv"
      className={className}
      onChange={(e) => onSelect(e.target.files?.[0] || null)}
    />
  );
}
