import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Activity, Heart, Zap, AlertTriangle } from "lucide-react"

export interface IntensityStepProps {
  value: number;
  onChange: (value: number) => void;
  cappedIntensity?: {
    original: number;
    capped: number;
    reason: string;
  };
}

const INTENSITY_LEVELS = [
  { value: 1, label: "Very Light", description: "Easy recovery pace", example: "Light stretching, walking", color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" },
  { value: 2, label: "Light", description: "Gentle movement", example: "Easy mobility work", color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" },
  { value: 3, label: "Light-Moderate", description: "Could maintain all day", example: "Brisk walk, light yoga", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" },
  { value: 4, label: "Moderate", description: "Comfortable effort", example: "Steady bike ride", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" },
  { value: 5, label: "Moderate-Hard", description: "Noticeable effort", example: "Tempo run, circuit training", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300" },
  { value: 6, label: "Hard", description: "Challenging but sustainable", example: "Strength training, intervals", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300" },
  { value: 7, label: "Very Hard", description: "Difficult to maintain", example: "HIIT, heavy lifting", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300" },
  { value: 8, label: "Extremely Hard", description: "Very challenging", example: "Sprint intervals, max effort", color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300" },
  { value: 9, label: "Maximal", description: "Near exhaustion", example: "Competition intensity", color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300" },
  { value: 10, label: "All-Out", description: "Maximum possible effort", example: "Personal record attempts", color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300" }
];

export function IntensityStep({ value, onChange, cappedIntensity }: IntensityStepProps) {
  const currentLevel = INTENSITY_LEVELS.find(level => level.value === value) || INTENSITY_LEVELS[5];
  
  const getIntensityIcon = (intensity: number) => {
    if (intensity <= 3) return Activity;
    if (intensity <= 6) return Heart;
    return Zap;
  };

  const IntensityIcon = getIntensityIcon(value);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">How intense should your workout be?</h2>
        <p className="text-muted-foreground">
          Rate your desired effort level from 1 (very easy) to 10 (maximum effort)
        </p>
      </div>

      {/* Health-Aware Intensity Capping Warning */}
      {cappedIntensity && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Intensity Recommendation
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                We capped today's intensity at {cappedIntensity.capped} based on your recovery metrics. 
                {cappedIntensity.reason} You can override this if you feel ready for more.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Intensity Slider */}
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Intensity Level</label>
            <div className="flex items-center gap-2">
              <IntensityIcon className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-primary">{value}</span>
            </div>
          </div>
          
          <Slider
            value={[value]}
            onValueChange={([newValue]) => onChange(newValue)}
            min={1}
            max={10}
            step={1}
            className="w-full"
            data-testid="intensity-slider"
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 - Very Light</span>
            <span>10 - All-Out</span>
          </div>
        </div>

        {/* Current Level Display */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <IntensityIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">{currentLevel.label}</h3>
                <Badge className={currentLevel.color}>{value}/10</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{currentLevel.description}</p>
              <p className="text-xs text-muted-foreground">
                <strong>Example:</strong> {currentLevel.example}
              </p>
            </div>
          </div>
        </Card>

        {/* Intensity Guidelines */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
                <h4 className="text-sm font-medium text-green-800 dark:text-green-200">Low (1-3)</h4>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                Recovery days, easy movement, stress relief
              </p>
            </div>
          </Card>
          
          <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Moderate (4-6)</h4>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                General fitness, sustainable daily training
              </p>
            </div>
          </Card>
          
          <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-600 dark:text-red-400" />
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200">High (7-10)</h4>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                Performance training, max effort days
              </p>
            </div>
          </Card>
        </div>

        {/* Intensity Tips */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">💡</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Choosing the Right Intensity</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Listen to your body - energy levels vary daily</li>
                <li>• Start conservative if you're new to training</li>
                <li>• Higher isn't always better - consistency beats intensity</li>
                <li>• We'll adjust the workout structure to match your choice</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}