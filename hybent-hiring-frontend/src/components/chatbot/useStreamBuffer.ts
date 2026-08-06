import { useState, useRef, useCallback, useEffect } from 'react';

export function useStreamBuffer(initialText: string = '') {
  const [displayText, setDisplayText] = useState<string>(initialText);
  const pendingBufferRef = useRef<string>('');
  const currentTextRef = useRef<string>(initialText);
  const animationFrameRef = useRef<number | null>(null);

  const flushBuffer = useCallback(() => {
    if (pendingBufferRef.current.length > 0) {
      currentTextRef.current += pendingBufferRef.current;
      pendingBufferRef.current = '';
      setDisplayText(currentTextRef.current);
    }
    animationFrameRef.current = null;
  }, []);

  const appendDelta = useCallback((delta: string) => {
    pendingBufferRef.current += delta;
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(flushBuffer);
    }
  }, [flushBuffer]);

  const resetBuffer = useCallback((newText: string = '') => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pendingBufferRef.current = '';
    currentTextRef.current = newText;
    setDisplayText(newText);
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    displayText,
    appendDelta,
    resetBuffer,
  };
}
