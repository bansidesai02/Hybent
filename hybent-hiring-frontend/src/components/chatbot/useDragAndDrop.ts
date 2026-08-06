import { useState, useCallback } from 'react';

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  file: File;
}

export function useDragAndDrop() {
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const processFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isDoc = file.type.includes('document') || file.name.endsWith('.docx');
      const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt');
      const isImg = file.type.startsWith('image/');
      return isPdf || isDoc || isTxt || isImg;
    });

    const newAttachments: FileAttachment[] = validFiles.map(file => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: file.name,
      size: file.size,
      type: file.type.startsWith('image/') ? 'image' : 'document',
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      file,
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const item = prev.find(a => a.id === id);
      if (item?.url) URL.revokeObjectURL(item.url);
      return prev.filter(a => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    attachments.forEach(a => {
      if (a.url) URL.revokeObjectURL(a.url);
    });
    setAttachments([]);
  }, [attachments]);

  return {
    isDragging,
    attachments,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    processFiles,
    removeAttachment,
    clearAttachments,
  };
}
