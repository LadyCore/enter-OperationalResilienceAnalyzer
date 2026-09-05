import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IMPORT_FIELDS, type ColumnMapping, type ImportField } from "@/lib/importer/types";
import { importFieldLabelKeys } from "./importFieldI18n";

interface ColumnMappingEditorProps {
  columns: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

export function ColumnMappingEditor({ columns, mapping, onChange }: ColumnMappingEditorProps) {
  const { t } = useTranslation();
  const setField = (field: ImportField, value: string | null) => {
    onChange({ ...mapping, [field]: value });
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">{t("importMapping.oraField")}</TableHead>
              <TableHead>{t("importMapping.sourceColumn")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {IMPORT_FIELDS.map((field) => (
              <TableRow key={field}>
                <TableCell>
                  <span className="text-sm font-medium">{t(importFieldLabelKeys[field])}</span>
                </TableCell>
                <TableCell className="min-w-52">
                  <Select
                    value={mapping[field] ?? "none"}
                    onValueChange={(v) => setField(field, v === "none" ? null : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("importMapping.notMapped")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("importMapping.notMapped")}</SelectItem>
                      {columns.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
