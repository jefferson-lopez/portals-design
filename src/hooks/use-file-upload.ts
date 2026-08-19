"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UploadedFile = {
  file: File;
  id: string;
  preview?: string;
};

type FileUploadOptions = {
  accept?: string;
  maxSize?: number;
};

function matchesAccept(file: File, accept: string) {
  return accept.split(",").some((entry) => {
    const rule = entry.trim().toLowerCase();
    if (!rule) return false;
    if (rule.endsWith("/*"))
      return file.type.toLowerCase().startsWith(rule.slice(0, -1));
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    return file.type.toLowerCase() === rule;
  });
}

export function useFileUpload({
  accept = "*/*",
  maxSize,
}: FileUploadOptions = {}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const filesRef = useRef(files);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const nextErrors: string[] = [];
      const validFiles = incoming.filter((file) => {
        if (!matchesAccept(file, accept)) {
          nextErrors.push(`${file.name}: File type is not supported.`);
          return false;
        }
        if (maxSize && file.size > maxSize) {
          nextErrors.push(
            `${file.name}: File exceeds the ${Math.round(maxSize / 1024 / 1024)}MB limit.`,
          );
          return false;
        }
        return true;
      });

      setErrors(nextErrors);
      setFiles((current) => {
        const existing = new Set(
          current.map(
            ({ file }) => `${file.name}:${file.size}:${file.lastModified}`,
          ),
        );
        const additions = validFiles
          .filter((file) => {
            const key = `${file.name}:${file.size}:${file.lastModified}`;
            if (existing.has(key)) return false;
            existing.add(key);
            return true;
          })
          .map((file) => ({
            file,
            id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
            preview: file.type.startsWith("image/")
              ? URL.createObjectURL(file)
              : undefined,
          }));
        return [...current, ...additions];
      });
    },
    [accept, maxSize],
  );

  const removeFile = useCallback((id?: string) => {
    if (!id) return;
    setFiles((current) => {
      const removed = current.find((file) => file.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return current.filter((file) => file.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((current) => {
      for (const { preview } of current) {
        if (preview) URL.revokeObjectURL(preview);
      }
      return [];
    });
    setErrors([]);
  }, []);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(
    () => () => {
      filesRef.current.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [],
  );

  return [
    { files, isDragging, errors },
    {
      handleDragEnter: (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(true);
      },
      handleDragLeave: (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
      },
      handleDragOver: (event: React.DragEvent) => event.preventDefault(),
      handleDrop: (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
        addFiles(Array.from(event.dataTransfer.files));
      },
      openFileDialog: () => inputRef.current?.click(),
      clearFiles,
      removeFile,
      getInputProps: () => ({
        accept,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        },
        ref: inputRef,
        type: "file" as const,
      }),
    },
  ] as const;
}
