import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRITICALITY_LABELS, type Criticality } from "@/types";

interface CriticalitySelectProps {
  value: Criticality;
  onChange: (value: Criticality) => void;
}

export function CriticalitySelect({ value, onChange }: CriticalitySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Criticality)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(CRITICALITY_LABELS) as Criticality[]).map((c) => (
          <SelectItem key={c} value={c}>
            {CRITICALITY_LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
