import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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

export interface SearchableOption {
  value: string;
  label: string;
  description?: string;
  /** Extra search terms (e.g. surname) that must not be shown verbatim. */
  searchTerms?: string[];
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

/** Accent-insensitive, case-insensitive normalization for name/surname search. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Single-select searchable combobox built on cmdk. Type a few letters and ORA
 * filters by full name (or any search term); pick one and the label stays in
 * the field. Shows a clear "No matches" state.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
}: SearchableSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const placeholderText = placeholder ?? t("searchableSelect.placeholder");
  const searchPlaceholderText = searchPlaceholder ?? t("common.search");
  const emptyTextLabel = emptyText ?? t("searchableSelect.empty");

  const selected = options.find((o) => o.value === value);
  const queryKey = normalize(query.trim());

  const filtered = options.filter((o) => {
    if (!queryKey) return true;
    const haystack = [o.label, ...(o.searchTerms ?? [])].map(normalize).join(" ");
    return haystack.includes(queryKey);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 w-full justify-between px-3 font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholderText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholderText}
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          {filtered.length === 0 ? (
            <CommandEmpty>{emptyTextLabel}</CommandEmpty>
          ) : (
            <CommandGroup className="max-h-60 overflow-y-auto">
              {filtered.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      o.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
