import { useState } from "react";
import { toast } from "sonner";
import { FileText, FolderOpen, GitBranch, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CriticalityBadge } from "@/components/common/CriticalityBadge";
import { DependencyBadge } from "@/components/common/DependencyBadge";
import { useOra } from "@/store/OraContext";
import { taskDependency } from "@/lib/analysis";
import type { OrgFunction, Process, Task } from "@/types";
import { FunctionFormDialog } from "./FunctionFormDialog";
import { ProcessFormDialog } from "./ProcessFormDialog";
import { TaskFormDialog } from "./TaskFormDialog";

interface DeleteTarget {
  collection: "processes" | "functions" | "tasks";
  id: string;
  label: string;
  cascadeNote?: string;
}

export function ProcessTree() {
  const { db, remove, upsert } = useOra();
  const [procDialog, setProcDialog] = useState<{ open: boolean; process?: Process }>({ open: false });
  const [fnDialog, setFnDialog] = useState<{
    open: boolean;
    fn?: OrgFunction;
    presetProcessId?: string;
  }>({ open: false });
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    task?: Task;
    presetFunctionId?: string;
  }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { collection, id } = deleteTarget;
    if (collection === "processes") {
      const fnIds = db.functions.filter((f) => f.processId === id).map((f) => f.id);
      const taskIds = db.tasks.filter((t) => fnIds.includes(t.functionId)).map((t) => t.id);
      taskIds.forEach((tid) => remove("tasks", tid));
      fnIds.forEach((fid) => remove("functions", fid));
      remove("processes", id);
      toast.success("Process and its functions/tasks deleted");
    } else if (collection === "functions") {
      db.tasks
        .filter((t) => t.functionId === id)
        .forEach((t) => remove("tasks", t.id));
      remove("functions", id);
      toast.success("Function and its tasks deleted");
    } else {
      remove("tasks", id);
      toast.success("Task deleted");
    }
    setDeleteTarget(null);
  };

  if (db.processes.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No processes yet"
        description="Create a process to start modeling your organization's structure."
        action={
          <Button onClick={() => setProcDialog({ open: true })}>
            <Plus className="h-4 w-4" /> New process
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {db.processes.map((process) => {
        const functions = db.functions.filter((f) => f.processId === process.id);
        return (
          <Card key={process.id} className="overflow-hidden">
            {/* Process header */}
            <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold">{process.name}</h3>
                    <CriticalityBadge criticality={process.criticality} />
                  </div>
                  {process.description && (
                    <p className="truncate text-xs text-muted-foreground">{process.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFnDialog({ open: true, presetProcessId: process.id })}
                >
                  <Plus className="h-3.5 w-3.5" /> Function
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setProcDialog({ open: true, process })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    setDeleteTarget({
                      collection: "processes",
                      id: process.id,
                      label: process.name,
                      cascadeNote: "This also deletes its functions and tasks.",
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Functions */}
            <div className="divide-y">
              {functions.length === 0 && (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  No functions yet in this process.
                </p>
              )}
              {functions.map((fn) => {
                const tasks = db.tasks.filter((t) => t.functionId === fn.id);
                return (
                  <div key={fn.id}>
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 pl-8">
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{fn.name}</span>
                          <CriticalityBadge criticality={fn.criticality} />
                        </div>
                        {fn.description && (
                          <p className="truncate text-xs text-muted-foreground">{fn.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTaskDialog({ open: true, presetFunctionId: fn.id })}
                        >
                          <Plus className="h-3.5 w-3.5" /> Task
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setFnDialog({ open: true, fn })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              collection: "functions",
                              id: fn.id,
                              label: fn.name,
                              cascadeNote: "This also deletes its tasks.",
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Tasks */}
                    {tasks.map((task) => {
                      const dep = taskDependency(db, task.id);
                      return (
                        <div key={task.id} className="flex flex-wrap items-center gap-3 border-t bg-card px-4 py-2.5 pl-16">
                          <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm">{task.name}</span>
                              <CriticalityBadge criticality={task.criticality} />
                              {!task.isDocumented && (
                                <Badge variant="outline" className="border-risk-medium/40 text-risk-medium">
                                  Not documented
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{dep.capableCount} capable</span>
                              {task.systemName && <span>{task.systemName}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DependencyBadge level={dep.level} />
                            <Button variant="ghost" size="icon" onClick={() => setTaskDialog({ open: true, task })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setDeleteTarget({ collection: "tasks", id: task.id, label: task.name })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* Bottom action */}
      <div className="flex justify-center pt-1">
        <Button variant="outline" onClick={() => setProcDialog({ open: true })}>
          <Plus className="h-4 w-4" /> Add process
        </Button>
      </div>

      {/* Dialogs */}
      <ProcessFormDialog
        open={procDialog.open}
        onOpenChange={(open) => setProcDialog((s) => ({ ...s, open }))}
        process={procDialog.process}
      />
      <FunctionFormDialog
        open={fnDialog.open}
        onOpenChange={(open) => setFnDialog((s) => ({ ...s, open }))}
        fn={fnDialog.fn}
        presetProcessId={fnDialog.presetProcessId}
      />
      <TaskFormDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog((s) => ({ ...s, open }))}
        task={taskDialog.task}
        presetFunctionId={taskDialog.presetFunctionId}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.label}"?`}
        description={
          deleteTarget?.cascadeNote
            ? deleteTarget.cascadeNote
            : "This action cannot be undone."
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}
