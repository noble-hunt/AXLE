import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Clock } from "lucide-react"

export interface TimeStepProps {
  value: number;
  onChange: (value: number) => void;
}

const QUICK_TIMES = [10, 20, 30, 45, 60];

export function TimeStep({ value, onChange }: TimeStepProps) {
  const [useSlider, setUseSlider] = useState(false);

  const getTimeDescription = (minutes: number) => {
    if (minutes <= 15) return "Quick session - Perfect for busy days or activation"
    if (minutes <= 30) return "Standard session - Balanced workout with warm-up and main work"
    if (minutes <= 45) return "Extended session - Full workout with accessories"
    return "Long session - Comprehensive training with multiple focuses"
  };

  const getTimeEmoji = (minutes: number) => {
    if (minutes <= 15) return "⚡"
    if (minutes <= 30) return "🎯"
    if (minutes <= 45) return "💪"
    return "🔥"
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">How much time do you have?</h2>
        <p className="text-muted-foreground">
          We'll design a workout that fits perfectly into your schedule
        </p>
      </div>

      {!useSlider ? (
        <>
          {/* Quick Time Pills */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {QUICK_TIMES.map((minutes) => (
                <Button
                  key={minutes}
                  variant={value === minutes ? "default" : "outline"}
                  onClick={() => onChange(minutes)}
                  className="h-16 flex flex-col gap-1"
                  data-testid={`time-pill-${minutes}`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{minutes} min</span>
                </Button>
              ))}
            </div>
            
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseSlider(true)}
                className="text-muted-foreground"
                data-testid="use-custom-time"
              >
                Need a custom time? Use slider instead
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Custom Slider */}
          <div className="space-y-4">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Custom Duration</label>
                  <span className="text-lg font-bold text-primary">{value} minutes</span>
                </div>
                <Slider
                  value={[value]}
                  onValueChange={([newValue]) => onChange(newValue)}
                  min={10}
                  max={60}
                  step={5}
                  className="w-full"
                  data-testid="time-slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10 min</span>
                  <span>60 min</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseSlider(false)}
                className="text-muted-foreground"
                data-testid="use-quick-times"
              >
                Back to quick select
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Time Description */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{getTimeEmoji(value)}</div>
          <div>
            <h3 className="font-medium text-foreground">{value} Minute Workout</h3>
            <p className="text-sm text-muted-foreground">{getTimeDescription(value)}</p>
          </div>
        </div>
      </Card>

      {/* Time Breakdown Preview */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">Estimated breakdown:</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Warm-up</span>
            <span>{Math.round(value * 0.15)} min</span>
          </div>
          <div className="flex justify-between text-foreground font-medium">
            <span>Main workout</span>
            <span>{Math.round(value * 0.7)} min</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Cool-down</span>
            <span>{Math.round(value * 0.15)} min</span>
          </div>
        </div>
      </div>
    </div>
  );
}