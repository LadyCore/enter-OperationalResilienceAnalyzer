import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder,
  emptyText,
  className,
}: MultiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const placeholderText = placeholder ?? t("multiSelect.placeholder");
  const emptyTextLabel = emptyText ?? t("multiSelect.empty");

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  const remove = (value: string) => onChange(values.filter((v) => v !== value));

  const selected = options.filter((o) => values.includes(o.value));
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase())
  );
  const visible = selected.slice(0, 2);
  const extraCount = selected.length - visible.length;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between px-3 py-2"
          >
            <span className="flex flex-wrap items-center gap-1.5">
              {selected.length === 0 && (
                <span className="text-sm text-muted-foreground">{placeholderText}</span>
              )}
              {visible.map((o) => (
                <Badge key={o.value} variant="secondary" className="gap-1 pr-1 font-normal">
                  {o.label}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(o.value);
                    }}
                    className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    aria-label={t("multiSelect.remove", { label: o.label })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {extraCount > 0 && (
                <Badge variant="secondary">{t("multiSelect.extraCount", { count: extraCount })}</Badge>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("common.search")} value={query} onValueChange={setQuery} />
            <CommandEmpty>{emptyTextLabel}</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {filtered.map((o) => {
                const isSelected = values.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.value} onSelect={() => toggle(o.value)}>
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border transition-colors",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0">
                      <span className="block">{o.label}</span>
                      {o.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
