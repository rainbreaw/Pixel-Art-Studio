/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Redo2, Undo2, Download, Grid3X3, Eraser, MousePointer2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const GRID_WIDTH = 700;
const GRID_HEIGHT = 500;
const PIXEL_SIZES = [10, 20, 30, 40, 50];
const COLORS_PER_PAGE = 8;

const ALL_COLORS = [
  '#FFCDD2', '#F44336', '#B71C1C', // Red
  '#FFE0B2', '#FF9800', '#E65100', // Orange
  '#FFF9C4', '#FFEB3B', '#FBC02D', // Yellow
  '#C8E6C9', '#4CAF50', '#1B5E20', // Green
  '#BBDEFB', '#2196F3', '#0D47A1', // Blue
  '#E1BEE7', '#9C27B0', '#4A148C', // Purple
  '#D7CCC8', '#795548', '#3E2723', // Brown
  '#F5F5F5', '#9E9E9E', '#212121', // Gray
  '#FFFFFF', '#000000',             // Mono
  '#E91E63', '#009688', '#CDDC39', // Pink, Teal, Lime
  '#00BCD4', '#3F51B5', '#FF4081'  // Cyan, Indigo, Rose
];

type PixelMap = Map<string, string>;

export default function App() {
  const [pixelSize, setPixelSize] = useState(20);
  const [pixels, setPixels] = useState<PixelMap>(new Map());
  const [history, setHistory] = useState<PixelMap[]>([]);
  const [redoHistory, setRedoHistory] = useState<PixelMap[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>('#000000');
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isJiggling, setIsJiggling] = useState(false);
  const [isClearJiggling, setIsClearJiggling] = useState(false);
  const [colorPageIndex, setColorPageIndex] = useState(0);
  const [isHoveringPixel, setIsHoveringPixel] = useState(false);
  
  // Dragging state for existing pixels
  const [draggingPixel, setDraggingPixel] = useState<{ color: string; startCol: number; startRow: number } | null>(null);
  const [isActualDrag, setIsActualDrag] = useState(false);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ col: number, row: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived grid properties for centered zoom
  const cols = Math.floor(GRID_WIDTH / pixelSize);
  const rows = Math.floor(GRID_HEIGHT / pixelSize);
  const offsetX = (GRID_WIDTH - cols * pixelSize) / 2;
  const offsetY = (GRID_HEIGHT - rows * pixelSize) / 2;

  // Save current state to history before modification
  const saveToHistory = useCallback((currentPixels: PixelMap) => {
    setHistory(prev => [new Map(currentPixels), ...prev]);
    setRedoHistory([]); // Clear redo history on new action
  }, []);

  const handleUndo = () => {
    if (history.length > 0) {
      const lastState = history[0];
      setRedoHistory(prev => [new Map(pixels), ...prev]);
      setPixels(new Map(lastState));
      setHistory(prev => prev.slice(1));
    }
  };

  const handleRedo = () => {
    if (redoHistory.length > 0) {
      const nextState = redoHistory[0];
      setHistory(prev => [new Map(pixels), ...prev]);
      setPixels(new Map(nextState));
      setRedoHistory(prev => prev.slice(1));
    }
  };

  const clearPixels = () => {
    if (pixels.size > 0) {
      saveToHistory(pixels);
      setPixels(new Map());
      setIsClearJiggling(true);
      setTimeout(() => setIsClearJiggling(false), 500);
    }
  };

  const placePixel = (col: number, row: number, color: string | null) => {
    const key = `${col},${row}`;

    setPixels(prev => {
      const newPixels = new Map(prev);
      if (color === null) {
        if (newPixels.has(key)) {
          saveToHistory(prev);
          newPixels.delete(key);
          setIsJiggling(true);
          setTimeout(() => setIsJiggling(false), 500);
        }
      } else {
        if (newPixels.get(key) !== color) {
          saveToHistory(prev);
          newPixels.set(key, color);
        }
      }
      return newPixels;
    });
  };

  const getGridCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor((x - offsetX) / pixelSize);
    const row = Math.floor((y - offsetY) / pixelSize);
    return { col, row, x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getGridCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (isEraserMode) {
      placePixel(coords.col, coords.row, null);
      return;
    }

    const key = `${coords.col},${coords.row}`;
    const existingColor = pixels.get(key);

    setMouseDownPos({ col: coords.col, row: coords.row });

    if (existingColor) {
      // Potential drag
      setDraggingPixel({ color: existingColor, startCol: coords.col, startRow: coords.row });
      setIsActualDrag(false);
    } else if (selectedColor) {
      // Just place a new pixel
      placePixel(coords.col, coords.row, selectedColor);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getGridCoords(e.clientX, e.clientY);
    if (!coords) {
      setIsHoveringPixel(false);
      return;
    }
    setCurrentMousePos({ x: coords.x, y: coords.y });

    const key = `${coords.col},${coords.row}`;
    setIsHoveringPixel(pixels.has(key) && !isEraserMode);

    if (draggingPixel && mouseDownPos) {
      // If we moved to a different cell, it's an actual drag
      if (coords.col !== mouseDownPos.col || coords.row !== mouseDownPos.row) {
        if (!isActualDrag) {
          setIsActualDrag(true);
          // Remove the original pixel from the board while dragging
          setPixels(prev => {
            const next = new Map(prev);
            next.delete(`${draggingPixel.startCol},${draggingPixel.startRow}`);
            return next;
          });
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getGridCoords(e.clientX, e.clientY);
    
    if (draggingPixel) {
      if (isActualDrag) {
        if (coords && coords.col >= 0 && coords.col < cols && coords.row >= 0 && coords.row < rows) {
          const key = `${coords.col},${coords.row}`;
          saveToHistory(pixels);
          setPixels(prev => {
            const next = new Map(prev);
            next.set(key, draggingPixel.color); // This replaces any existing color
            return next;
          });
        } else {
          // Put it back if dropped outside
          setPixels(prev => {
            const next = new Map(prev);
            next.set(`${draggingPixel.startCol},${draggingPixel.startRow}`, draggingPixel.color);
            return next;
          });
        }
      } else if (coords && coords.col === draggingPixel.startCol && coords.row === draggingPixel.startRow) {
        // It was a click on an existing pixel, replace its color
        if (selectedColor) {
          placePixel(coords.col, coords.row, selectedColor);
        }
      }
      setDraggingPixel(null);
      setIsActualDrag(false);
    }
    
    setMouseDownPos(null);
    setCurrentMousePos(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // We handle logic in mouse down/up now for dragging
  };

  const handleDragEnd = (event: any, info: any, color: string) => {
    const coords = getGridCoords(info.point.x, info.point.y);
    if (coords && coords.x >= 0 && coords.x <= GRID_WIDTH && coords.y >= 0 && coords.y <= GRID_HEIGHT) {
      placePixel(coords.col, coords.row, color);
    }
  };

  const cyclePixelSize = () => {
    setPixelSize(prev => {
      const currentIndex = PIXEL_SIZES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % PIXEL_SIZES.length;
      return PIXEL_SIZES[nextIndex];
    });
  };

  const downloadImage = () => {
    const canvas = document.createElement('canvas');
    const scale = 10;
    canvas.width = GRID_WIDTH * scale;
    canvas.height = GRID_HEIGHT * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw pixels at 10x scale
    pixels.forEach((color, key) => {
      const [col, row] = key.split(',').map(Number);
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        ctx.fillStyle = color;
        ctx.fillRect(
          (offsetX + col * pixelSize) * scale, 
          (offsetY + row * pixelSize) * scale, 
          pixelSize * scale, 
          pixelSize * scale
        );
      }
    });

    const link = document.createElement('a');
    link.download = 'pixel-art.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, GRID_WIDTH, GRID_HEIGHT);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + i * pixelSize, offsetY);
      ctx.lineTo(offsetX + i * pixelSize, offsetY + rows * pixelSize);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + j * pixelSize);
      ctx.lineTo(offsetX + cols * pixelSize, offsetY + j * pixelSize);
      ctx.stroke();
    }

    // Draw pixels
    pixels.forEach((color, key) => {
      const [col, row] = key.split(',').map(Number);
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + col * pixelSize, offsetY + row * pixelSize, pixelSize, pixelSize);
      }
    });

    // Draw dragging pixel preview
    if (draggingPixel && isActualDrag && currentMousePos) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = draggingPixel.color;
      const snapCol = Math.floor((currentMousePos.x - offsetX) / pixelSize);
      const snapRow = Math.floor((currentMousePos.y - offsetY) / pixelSize);
      if (snapCol >= 0 && snapCol < cols && snapRow >= 0 && snapRow < rows) {
        ctx.fillRect(offsetX + snapCol * pixelSize, offsetY + snapRow * pixelSize, pixelSize, pixelSize);
      }
      ctx.restore();
    }
  }, [pixels, pixelSize, draggingPixel, isActualDrag, currentMousePos, offsetX, offsetY, cols, rows]);

  const nextColorPage = () => {
    setColorPageIndex(prev => (prev + 1) % Math.ceil(ALL_COLORS.length / COLORS_PER_PAGE));
  };

  const prevColorPage = () => {
    setColorPageIndex(prev => (prev - 1 + Math.ceil(ALL_COLORS.length / COLORS_PER_PAGE)) % Math.ceil(ALL_COLORS.length / COLORS_PER_PAGE));
  };

  const visibleColors = ALL_COLORS.slice(
    colorPageIndex * COLORS_PER_PAGE,
    (colorPageIndex + 1) * COLORS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-8 font-sans text-[#212529]">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic text-[#1a1a1a]">
          Pixel Art Studio
        </h1>
        <p className="text-sm text-gray-500 font-mono uppercase tracking-widest mt-2">
          Create • Snap • Save
        </p>
      </header>

      <div className="flex gap-8 items-start">
        {/* Main Canvas Area */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-white/50 blur-xl rounded-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="bg-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100">
            <canvas
              ref={canvasRef}
              width={GRID_WIDTH}
              height={GRID_HEIGHT}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (draggingPixel) {
                  // Return pixel to original spot if dragged off canvas
                  setPixels(prev => {
                    const next = new Map(prev);
                    next.set(`${draggingPixel.startCol},${draggingPixel.startRow}`, draggingPixel.color);
                    return next;
                  });
                  setDraggingPixel(null);
                  setIsActualDrag(false);
                }
                setMouseDownPos(null);
                setCurrentMousePos(null);
              }}
              className={`${isActualDrag ? 'cursor-grabbing' : isHoveringPixel ? 'cursor-grab' : 'cursor-crosshair'} bg-[#fafafa] rounded-lg`}
              style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}
            />
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Color Selector in Sidebar */}
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 w-40">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#333333] mb-1">Colors</div>
            <div className="flex items-center justify-between w-full px-1">
              <button 
                onClick={prevColorPage}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-[#333333]"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="grid grid-cols-2 grid-rows-4 gap-2">
                {visibleColors.map((color) => (
                  <motion.div
                    key={color}
                    drag
                    dragSnapToOrigin
                    onDragEnd={(e, info) => handleDragEnd(e, info, color)}
                    onClick={() => {
                      setSelectedColor(color);
                      setIsEraserMode(false);
                    }}
                    className={`w-8 h-8 rounded-md cursor-grab active:cursor-grabbing shadow-sm border-2 transition-all hover:scale-110 ${
                      selectedColor === color && !isEraserMode ? 'border-white ring-1 ring-black shadow-[0_10px_20px_rgba(0,0,0,0.2)] scale-110 z-10' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.9 }}
                  />
                ))}
              </div>

              <button 
                onClick={nextColorPage}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-[#333333]"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <ControlButton
            icon={<Grid3X3 size={20} />}
            label={`${pixelSize}px`}
            onClick={cyclePixelSize}
            tooltip="Change Pixel Size"
          />
          <div className="flex gap-2">
            <ControlButton
              icon={<Undo2 size={20} />}
              label="Undo"
              onClick={handleUndo}
              disabled={history.length === 0}
              tooltip="Undo Last Action"
              className="w-[76px] px-2"
              vertical
            />
            <ControlButton
              icon={<Redo2 size={20} />}
              label="Redo"
              onClick={handleRedo}
              disabled={redoHistory.length === 0}
              tooltip="Redo Last Action"
              className="w-[76px] px-2"
              vertical
            />
          </div>

          <ControlButton
            icon={
              <motion.div
                animate={isJiggling ? {
                  rotate: [0, -15, 15, -15, 15, 0],
                  scale: [1, 1.2, 1]
                } : {}}
                transition={{ duration: 0.4 }}
              >
                <Eraser size={20} />
              </motion.div>
            }
            label="Erase"
            onClick={() => setIsEraserMode(!isEraserMode)}
            active={isEraserMode}
            tooltip="Eraser Tool"
          />

          <ControlButton
            icon={
              <motion.div
                animate={isClearJiggling ? {
                  rotate: [0, -15, 15, -15, 15, 0],
                  scale: [1, 1.2, 1]
                } : {}}
                transition={{ duration: 0.4 }}
              >
                <Trash2 size={20} />
              </motion.div>
            }
            label="Clear All"
            onClick={clearPixels}
            tooltip="Clear All Pixels"
            className="bg-white hover:bg-gray-50"
          />
          
          <ControlButton
            icon={<Download size={20} />}
            label="Save to PNG"
            onClick={downloadImage}
            tooltip="Download PNG"
            className="bg-white hover:bg-gray-50"
          />
        </div>
      </div>

      <footer className="mt-12 text-gray-400 text-[11px] font-mono uppercase tracking-[0.2em]">
        Built with Precision • 2026
      </footer>
    </div>
  );
}

function ControlButton({ 
  icon, 
  label, 
  onClick, 
  disabled = false, 
  active = false, 
  className = '',
  tooltip = '',
  vertical = false
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void; 
  disabled?: boolean;
  active?: boolean;
  className?: string;
  tooltip?: string;
  vertical?: boolean;
}) {
  return (
    <motion.button
      whileHover={!disabled ? { x: vertical ? 0 : 4, y: vertical ? -2 : 0 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`
        flex items-center justify-center rounded-2xl border transition-all duration-200 w-40 shadow-sm
        text-[#333333]
        ${vertical ? 'flex-col gap-1 py-2' : 'gap-3 px-4 py-3'}
        ${disabled ? 'opacity-30 cursor-not-allowed bg-gray-50 border-gray-100' : 
          active ? 'bg-[#f0fdf4] border-[#22c55e] border-2' : 
          'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'}
        ${className}
      `}
    >
      <span className="shrink-0">{icon}</span>
      <span className={`font-bold uppercase tracking-wider ${vertical ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
    </motion.button>
  );
}
