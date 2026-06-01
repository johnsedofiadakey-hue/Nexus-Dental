"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
// Removed ScrollArea import
import { PenLine, RotateCcw, CheckCircle2 } from "lucide-react";

export interface ConsentSignerProps {
  template: { title: string; content: string };
  patientName: string;
  onSign: (signatureDataUrl: string) => void;
  onCancel: () => void;
}

export function ConsentSigner({
  template,
  patientName,
  onSign,
  onCancel,
}: ConsentSignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas initialisation ────────────────────────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0d9488"; // teal-600
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // ── Coordinate helpers ────────────────────────────────────────
  function getPos(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  // ── Draw handlers ─────────────────────────────────────────────
  function handleStart(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
  }

  function handleMove(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPos.current = pos;
    setIsSigned(true);
  }

  function handleEnd() {
    setIsDrawing(false);
    lastPos.current = null;
  }

  // ── Clear ─────────────────────────────────────────────────────
  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsSigned(false);
  }

  // ── Submit ────────────────────────────────────────────────────
  function handleSign() {
    const canvas = canvasRef.current;
    if (!canvas || !isSigned) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSign(dataUrl);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{template.title}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please read the entire consent form below before signing.
        </p>
      </div>

      {/* Patient name banner */}
      <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
        <p className="text-sm text-teal-800">
          Consent being obtained for:{" "}
          <span className="font-semibold">{patientName}</span>
        </p>
      </div>

      {/* Consent text */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="h-64 px-5 py-4 overflow-y-auto">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {template.content}
          </pre>
        </div>
      </div>

      {/* Signature pad */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <PenLine className="h-4 w-4 text-teal-600" />
            Patient Signature
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-gray-500 hover:text-gray-700 h-8 px-3 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        </div>

        <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden hover:border-teal-400 transition-colors">
          <canvas
            ref={canvasRef}
            width={700}
            height={160}
            className="w-full touch-none cursor-crosshair"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
          {!isSigned && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-400 select-none">
                Sign here using mouse or touch
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          By signing above, you confirm you have read and understood the consent form.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!isSigned}
          onClick={handleSign}
          className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          I Agree &amp; Sign
        </Button>
      </div>
    </div>
  );
}
