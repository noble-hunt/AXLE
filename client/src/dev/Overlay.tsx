import { useState, useEffect } from "react";
import { X, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/swift/button";
import { Card } from "@/components/swift/card";

interface OverlaySettings {
  opacity: number;
  scale: number;
  x: number;
  y: number;
  visible: boolean;
}

const DEFAULT_SETTINGS: OverlaySettings = {
  opacity: 0.5,
  scale: 1,
  x: 0,
  y: 0,
  visible: true,
};

interface OverlayProps {
  imageName: string;
  onClose: () => void;
}

export function Overlay({ imageName, onClose }: OverlayProps) {
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [showControls, setShowControls] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const storageKey = `overlay-settings-${imageName}`;

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.warn("Failed to parse overlay settings:", e);
      }
    }
  }, [storageKey]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings, storageKey]);

  const updateSetting = (key: keyof OverlaySettings, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setDragging(true);
      setDragStart({
        x: e.clientX - settings.x,
        y: e.clientY - settings.y,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragging) {
      updateSetting("x", e.clientX - dragStart.x);
      updateSetting("y", e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, dragStart]);

  if (!settings.visible) return null;

  return (
    <>
      {/* Overlay Image */}
      <div
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          transform: `translate(${settings.x}px, ${settings.y}px) scale(${settings.scale})`,
          opacity: settings.opacity,
        }}
      >
        <img
          src={`/ui_ref/${imageName}`}
          alt="UI Reference Overlay"
          className="w-full h-full object-contain cursor-move pointer-events-auto"
          onMouseDown={handleMouseDown}
          draggable={false}
        />
      </div>

      {/* Controls */}
      {showControls && (
        <Card className="fixed top-4 right-4 z-[9999] p-4 bg-surface/95 backdrop-blur-sm border shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Overlay Controls</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowControls(false)}
                data-testid="minimize-controls"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                data-testid="close-overlay"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 min-w-[200px]">
            {/* Opacity */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Opacity ({Math.round(settings.opacity * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.opacity}
                onChange={(e) => updateSetting("opacity", parseFloat(e.target.value))}
                className="w-full"
                data-testid="opacity-slider"
              />
            </div>

            {/* Scale */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Scale ({Math.round(settings.scale * 100)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={settings.scale}
                onChange={(e) => updateSetting("scale", parseFloat(e.target.value))}
                className="w-full"
                data-testid="scale-slider"
              />
            </div>

            {/* Position */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">X: {settings.x}px</label>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  value={settings.x}
                  onChange={(e) => updateSetting("x", parseInt(e.target.value))}
                  className="w-full"
                  data-testid="x-position-slider"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Y: {settings.y}px</label>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  value={settings.y}
                  onChange={(e) => updateSetting("y", parseInt(e.target.value))}
                  className="w-full"
                  data-testid="y-position-slider"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="secondary"
                size="sm"
                onClick={resetSettings}
                className="flex-1"
                data-testid="reset-overlay"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateSetting("visible", false)}
                className="flex-1"
                data-testid="hide-overlay"
              >
                Hide
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Minimized controls button */}
      {!showControls && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowControls(true)}
          className="fixed top-4 right-4 z-[9999] bg-surface/95 backdrop-blur-sm"
          data-testid="show-controls"
        >
          <Settings className="w-4 h-4" />
        </Button>
      )}
    </>
  );
}