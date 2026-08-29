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
import { IMPORT_FIELD_LABELS, IMPORT_FIELDS, type ColumnMapping, type ImportField } from "@/lib/importer/types";

interface ColumnMappingEditorProps {
  columns: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

export function ColumnMappingEditor({ columns, mapping, onChange }: ColumnMappingEditorProps) {
  const setField = (field: ImportField, value: string | null) => {
    onChange({ ...mapping, [field]: value });
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">ORA field</TableHead>
              <TableHead>Source column</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {IMPORT_FIELDS.map((field) => (
              <TableRow key={field}>
                <TableCell>
                  <span className="text-sm font-medium">{IMPORT_FIELD_LABELS[field]}</span>
                </TableCell>
                <TableCell className="min-w-52">
                  <Select
                    value={mapping[field] ?? "none"}
                    onValueChange={(v) => setField(field, v === "none" ? null : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not mapped</SelectItem>
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
