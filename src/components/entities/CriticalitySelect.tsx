import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Criticality } from "@/types";

interface CriticalitySelectProps {
  value: Criticality;
  onChange: (value: Criticality) => void;
}

const labelKeys: Record<Criticality, string> = {
  critical: "criticality.critical",
  important: "criticality.important",
  standard: "criticality.standard",
};

export function CriticalitySelect({ value, onChange }: CriticalitySelectProps) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Criticality)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(labelKeys) as Criticality[]).map((c) => (
          <SelectItem key={c} value={c}>
            {t(labelKeys[c])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
