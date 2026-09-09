import { useRef, useState } from "react";
import { CloudIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadAreaProps {
  onClose: () => void;
  onUpload: (files: File[]) => void;
}

export default function FileUploadArea({ onClose, onUpload }: FileUploadAreaProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-fast",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-accent/60",
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CloudIcon className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Drag and drop medical files or{" "}
          <span className="font-medium text-primary">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports images and PDF lab reports
        </p>
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          accept="image/*,.pdf"
          multiple
          onChange={handleFileSelect}
        />
      </div>

      {selectedFiles.length > 0 ? (
        <div className="mt-3 rounded-md bg-muted/40 p-3">
          <h3 className="mb-2 text-sm font-medium">Selected files</h3>
          <ul className="space-y-1 text-xs">
            {selectedFiles.map((file, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onUpload(selectedFiles)}
          disabled={selectedFiles.length === 0}
        >
          Upload
        </Button>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
