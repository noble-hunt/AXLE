import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip } from "@/components/swift/chip"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Dumbbell, CheckCircle2 } from "lucide-react"

export interface EquipmentStepProps {
  value: string[];
  userEquipment: string[];
  onChange: (value: string[]) => void;
}

const COMMON_EQUIPMENT = [
  { id: 'bodyweight', name: 'Bodyweight', emoji: '💪' },
  { id: 'dumbbells', name: 'Dumbbells', emoji: '🏋️' },
  { id: 'barbell', name: 'Barbell', emoji: '🏋️‍♂️' },
  { id: 'kettlebell', name: 'Kettlebell', emoji: '⚫' },
  { id: 'resistance_bands', name: 'Resistance Bands', emoji: '🎗️' },
  { id: 'pull_up_bar', name: 'Pull-up Bar', emoji: '🔗' },
  { id: 'bench', name: 'Bench', emoji: '🪑' },
  { id: 'rower', name: 'Rowing Machine', emoji: '🚣' },
  { id: 'bike', name: 'Exercise Bike', emoji: '🚴' },
  { id: 'treadmill', name: 'Treadmill', emoji: '🏃' },
  { id: 'jump_rope', name: 'Jump Rope', emoji: '🪢' },
  { id: 'medicine_ball', name: 'Medicine Ball', emoji: '⚽' },
];

export function EquipmentStep({ value, userEquipment, onChange }: EquipmentStepProps) {
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const toggleEquipment = (equipmentId: string) => {
    if (value.includes(equipmentId)) {
      onChange(value.filter(id => id !== equipmentId));
    } else {
      onChange([...value, equipmentId]);
    }
  };

  const addCustomEquipment = () => {
    if (customInput.trim() && !value.includes(customInput.trim().toLowerCase())) {
      onChange([...value, customInput.trim().toLowerCase()]);
      setCustomInput("");
      setShowCustom(false);
    }
  };

  const removeEquipment = (equipmentId: string) => {
    onChange(value.filter(id => id !== equipmentId));
  };

  const selectAll = () => {
    const allIds = COMMON_EQUIPMENT.map(eq => eq.id);
    onChange(allIds);
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectFromProfile = () => {
    onChange([...userEquipment]);
  };

  const getEquipmentName = (id: string) => {
    const equipment = COMMON_EQUIPMENT.find(eq => eq.id === id);
    return equipment ? equipment.name : id.charAt(0).toUpperCase() + id.slice(1);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">What equipment do you have?</h2>
        <p className="text-muted-foreground">
          Select all available equipment to get the best workout recommendations
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={selectAll} data-testid="select-all-equipment">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={clearAll} data-testid="clear-all-equipment">
          <X className="w-4 h-4 mr-2" />
          Clear All
        </Button>
        {userEquipment.length > 0 && (
          <Button variant="outline" size="sm" onClick={selectFromProfile} data-testid="use-profile-equipment">
            <Dumbbell className="w-4 h-4 mr-2" />
            Use My Equipment
          </Button>
        )}
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {COMMON_EQUIPMENT.map((equipment) => {
          const isSelected = value.includes(equipment.id);
          
          return (
            <Card
              key={equipment.id}
              className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => toggleEquipment(equipment.id)}
              data-testid={`equipment-${equipment.id}`}
            >
              <div className="text-center space-y-2">
                <div className="text-2xl">{equipment.emoji}</div>
                <p className="text-sm font-medium text-foreground">{equipment.name}</p>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Custom Equipment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Custom Equipment</h3>
          {!showCustom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustom(true)}
              data-testid="add-custom-equipment"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom
            </Button>
          )}
        </div>

        {showCustom && (
          <div className="flex gap-2">
            <Input
              placeholder="Enter equipment name..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomEquipment()}
              data-testid="custom-equipment-input"
            />
            <Button onClick={addCustomEquipment} size="sm" data-testid="add-custom-submit">
              Add
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowCustom(false)} 
              size="sm"
              data-testid="cancel-custom"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Selected Equipment */}
      {value.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Selected Equipment ({value.length})</h3>
          <div className="flex flex-wrap gap-2">
            {value.map((equipmentId) => (
              <Chip
                key={equipmentId}
                variant="primary"
                removable
                onRemove={() => removeEquipment(equipmentId)}
                data-testid={`selected-equipment-${equipmentId}`}
              >
                {getEquipmentName(equipmentId)}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* No Equipment Warning */}
      {value.length === 0 && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">!</span>
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Select at least one equipment option</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                Choose "Bodyweight" if you don't have any equipment - we'll create bodyweight-only workouts.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Equipment Tips */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-primary">💡</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Pro Tips</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• More equipment = more exercise variety</li>
              <li>• Bodyweight workouts are just as effective</li>
              <li>• We'll suggest substitutions if needed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}