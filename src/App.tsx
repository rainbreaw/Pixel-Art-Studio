/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Undo2, Download, Grid3X3, Eraser, MousePointer2, ChevronLeft, ChevronRight } from 'lucide-react';

const GRID_WIDTH = 700;
const GRID_HEIGHT = 500;
const PIXEL_SIZES = [10, 20, 30, 40, 50];
const MAX_UNDO = 12;
const COLORS_PER_PAGE = 4;

const ALL_COLORS = [
  '#FFCDD2', '#F44336', '#B71C1C', // Red
  '#FFE0B2', '#FF9800', '#E65100', // Orange
  '#FFF9C4', '#FFEB3B', '#FBC02D', // Yellow
  '#C8E6C9', '#4CAF50', '#1B5E20', // Green
  '#BBDEFB', '#2196F3', '#0D47A1', // Blue
  '#E1BEE7', '#9C27B0', '#4A148C', // Purple
  '#D7CCC8', '#795548', '#3E2723', // Brown
  '#F5F5F5', '#9E9E9E', '#212121', // Gray
  '#FFFFFF', '#000000'             // Mono
];

type PixelMap = Map<string, string>;

export default function App() {
  const [pixelSize, setPixelSize] = useState(20);
  const [pixels, setPixels] = useState<PixelMap>(new Map());
  const [history, setHistory] = useState<PixelMap[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>('#000000');
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isJiggling, setIsJiggling] = useState(false);
  const [colorPageIndex, setColorPageIndex] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save current state to history before modification
  const saveToHistory = useCallback((currentPixels: PixelMap) => {
    setHistory(prev => {
      const newHistory = [new Map(currentPixels), ...prev];
      return newHistory.slice(0, MAX_UNDO);
    });
  }, []);

  const handleUndo = () => {
    if (history.length > 0) {
      const lastState = history[0];
      setPixels(new Map(lastState));
      setHistory(prev => prev.slice(1));
    }
  };

  const placePixel = (x: number, y: number, color: string | null) => {
    const snappedX = Math.floor(x / pixelSize) * pixelSize;
    const snappedY = Math.floor(y / pixelSize) * pixelSize;
    const key = `${snappedX},${snappedY}`;

    if (snappedX < 0 || snappedX >= GRID_WIDTH || snappedY < 0 || snappedY >= GRID_HEIGHT) return;

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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isEraserMode) {
      placePixel(x, y, null);
    } else if (selectedColor) {
      placePixel(x, y, selectedColor);
    }
  };

  const handleDragEnd = (event: any, info: any, color: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = info.point.x - rect.left;
    const y = info.point.y - rect.top;

    if (x >= 0 && x <= GRID_WIDTH && y >= 0 && y <= GRID_HEIGHT) {
      placePixel(x, y, color);
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
    canvas.width = GRID_WIDTH;
    canvas.height = GRID_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, GRID_WIDTH, GRID_HEIGHT);

    // Draw pixels
    pixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, pixelSize, pixelSize);
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
    for (let x = 0; x <= GRID_WIDTH; x += pixelSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GRID_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_HEIGHT; y += pixelSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GRID_WIDTH, y);
      ctx.stroke();
    }

    // Draw pixels
    pixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, pixelSize, pixelSize);
    });
  }, [pixels, pixelSize]);

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
              onClick={handleCanvasClick}
              className="cursor-crosshair bg-[#fafafa] rounded-lg"
              style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}
            />
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Color Selector in Sidebar */}
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 w-40">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Colors</div>
            <div className="flex items-center justify-between w-full px-1">
              <button 
                onClick={prevColorPage}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-black"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="grid grid-cols-2 grid-rows-2 gap-2">
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
                    className={`w-8 h-8 rounded-md cursor-grab active:cursor-grabbing shadow-sm border-2 transition-transform hover:scale-110 ${
                      selectedColor === color && !isEraserMode ? 'border-black scale-110 z-10' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.9 }}
                  />
                ))}
              </div>

              <button 
                onClick={nextColorPage}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-black"
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
          <ControlButton
            icon={<Undo2 size={20} />}
            label="Undo"
            onClick={handleUndo}
            disabled={history.length === 0}
            tooltip="Undo Last Action"
          />
          <motion.div
            animate={isJiggling ? {
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1]
            } : {}}
            transition={{ duration: 0.5 }}
          >
            <ControlButton
              icon={<Trash2 size={20} />}
              label="Erase"
              onClick={() => setIsEraserMode(!isEraserMode)}
              active={isEraserMode}
              tooltip="Eraser Tool"
              className={isEraserMode ? 'bg-red-50 text-red-600 border-red-200' : ''}
            />
          </motion.div>
          <ControlButton
            icon={<Download size={20} />}
            label="Save"
            onClick={downloadImage}
            tooltip="Download PNG"
            className="bg-black text-white border-black hover:bg-gray-800"
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
  tooltip = ''
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void; 
  disabled?: boolean;
  active?: boolean;
  className?: string;
  tooltip?: string;
}) {
  return (
    <motion.button
      whileHover={!disabled ? { x: 4 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 w-40
        ${disabled ? 'opacity-30 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400' : 
          active ? 'bg-black text-white border-black shadow-lg' : 
          'bg-white border-gray-100 text-gray-600 hover:border-gray-300 hover:shadow-md'}
        ${className}
      `}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </motion.button>
  );
}
