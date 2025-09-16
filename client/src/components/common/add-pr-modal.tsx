import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/store/useAppStore'
import {
  Movement,
  MovementCategory,
  RepMaxType,
  Unit,
  getMovementsByCategory,
  getDefaultUnitForMovement,
  shouldShowRepMaxForMovement,
  isWeightBasedMovement,
} from '../../types'

interface AddPRModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedMovement?: Movement
  preselectedCategory?: MovementCategory
}

const formSchema = z.object({
  movement: z.string().min(1, 'Movement is required'),
  movementCategory: z.nativeEnum(MovementCategory),
  repMax: z.nativeEnum(RepMaxType).optional(),
  value: z.union([
    z.number().positive('Value must be positive'),
    z.string().min(1, 'Value is required')
  ]),
  unit: z.nativeEnum(Unit),
  date: z.date(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function AddPRModal({
  isOpen,
  onClose,
  preselectedMovement,
  preselectedCategory = MovementCategory.POWERLIFTING,
}: AddPRModalProps) {
  const { addPR } = useAppStore()
  const { toast } = useToast()
  const [selectedCategory, setSelectedCategory] = useState<MovementCategory>(preselectedCategory)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      movementCategory: preselectedCategory,
      movement: preselectedMovement || '',
      date: new Date(),
      value: 0,
      unit: preselectedMovement ? getDefaultUnitForMovement(preselectedMovement) : Unit.LBS,
      repMax: preselectedMovement && shouldShowRepMaxForMovement(preselectedMovement) 
        ? RepMaxType.ONE_RM 
        : undefined,
    },
  })

  const selectedMovement = form.watch('movement') as Movement
  const selectedUnit = form.watch('unit')

  // Get movements for selected category
  const availableMovements = getMovementsByCategory(selectedCategory)

  const onSubmit = (data: FormData) => {
    try {
      // Convert string time to proper format if needed
      let finalValue: number | string = data.value
      if (data.unit === Unit.TIME && typeof data.value === 'string') {
        // Validate time format (mm:ss)
        const timeRegex = /^\d{1,2}:\d{2}$/
        if (!timeRegex.test(data.value)) {
          toast({
            title: 'Invalid time format',
            description: 'Please use mm:ss format (e.g., 22:45)',
            variant: 'destructive',
          })
          return
        }
        finalValue = data.value
      } else if (typeof data.value === 'string') {
        // Try to convert to number
        const numValue = parseFloat(data.value)
        if (isNaN(numValue)) {
          toast({
            title: 'Invalid value',
            description: 'Please enter a valid number',
            variant: 'destructive',
          })
          return
        }
        finalValue = numValue
      }

      // Create legacy fields for backwards compatibility
      const exerciseName = data.movement
      const weight = data.unit === Unit.LBS || data.unit === Unit.KG ? 
        (typeof finalValue === 'number' ? finalValue : 0) : 0
      const reps = data.unit === Unit.REPS ? 
        (typeof finalValue === 'number' ? finalValue : 1) : 1

      addPR({
        // Legacy fields
        exercise: exerciseName,
        category: data.movementCategory === MovementCategory.POWERLIFTING 
          ? 'Powerlifting' as any
          : data.movementCategory === MovementCategory.OLYMPIC_WEIGHTLIFTING
          ? 'Olympic Lifting' as any
          : 'Gymnastics' as any,
        weight,
        reps,
        date: data.date,
        
        // Enhanced fields
        movement: data.movement as Movement,
        movementCategory: data.movementCategory,
        repMax: data.repMax,
        value: finalValue,
        unit: data.unit,
        notes: data.notes,
      })

      toast({
        title: 'PR Added!',
        description: `New personal record for ${data.movement}`,
      })

      onClose()
      form.reset()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add PR. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleCategoryChange = (category: MovementCategory) => {
    setSelectedCategory(category)
    form.setValue('movementCategory', category)
    form.setValue('movement', '') // Reset movement when category changes
  }

  const handleMovementChange = (movement: string) => {
    form.setValue('movement', movement)
    const movementTyped = movement as Movement
    
    // Set default unit based on movement
    const defaultUnit = getDefaultUnitForMovement(movementTyped)
    form.setValue('unit', defaultUnit)
    
    // Set default rep max if applicable
    if (shouldShowRepMaxForMovement(movementTyped)) {
      form.setValue('repMax', RepMaxType.ONE_RM)
    } else {
      form.setValue('repMax', undefined)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Personal Record</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="movementCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={handleCategoryChange}
                    data-testid="select-movement-category"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(MovementCategory).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="movement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Movement</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={handleMovementChange}
                    data-testid="select-movement"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select movement" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableMovements.map((movement) => (
                        <SelectItem key={movement} value={movement}>
                          {movement}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedMovement && shouldShowRepMaxForMovement(selectedMovement) && (
              <FormField
                control={form.control}
                name="repMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rep Max</FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      data-testid="select-rep-max"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rep max" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(RepMaxType).map((repMax) => (
                          <SelectItem key={repMax} value={repMax}>
                            {repMax}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type={selectedUnit === Unit.TIME ? 'text' : 'number'}
                        placeholder={selectedUnit === Unit.TIME ? 'mm:ss' : 'Enter value'}
                        step={selectedUnit === Unit.LBS || selectedUnit === Unit.KG ? '0.5' : '1'}
                        onChange={(e) => {
                          const value = selectedUnit === Unit.TIME ? e.target.value : parseFloat(e.target.value) || 0
                          field.onChange(value)
                        }}
                        data-testid="input-pr-value"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} data-testid="select-unit">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(Unit).map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          data-testid="button-select-date"
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add any notes about this PR..."
                      rows={2}
                      data-testid="textarea-pr-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" data-testid="button-add-pr">
                Add PR
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}