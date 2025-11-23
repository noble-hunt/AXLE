import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Home, 
  Search, 
  Plus, 
  Settings, 
  Star, 
  TrendingUp,
  Clock,
  Target,
  Zap,
  Trophy,
  Activity,
  CheckCircle
} from "lucide-react";
import { 
  Card,
  Button,
  SegmentedControl,
  Segment,
  Chip,
  Field,
  StatBadge,
  MetricCard,
  NavBar,
  NavBarContent,
  NavBarTitle,
  NavBarActions,
  TabBar,
  TabItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/swift";
import { fadeIn, slideUp, container, item } from "@/lib/motion-variants";

export default function ComponentsDemo() {
  const [segmentValue, setSegmentValue] = useState("design");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fieldValue, setFieldValue] = useState("");
  const [fieldError, setFieldError] = useState("");

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFieldValue(value);
    setFieldError(value.length < 3 && value.length > 0 ? "Must be at least 3 characters" : "");
  };

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-background"
      data-testid="components-demo-page"
    >
      {/* Demo NavBar */}
      <NavBar variant="blur">
        <NavBarContent>
          <NavBarTitle>Swift Components</NavBarTitle>
          <NavBarActions>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </NavBarActions>
        </NavBarContent>
      </NavBar>

      <div className="space-y-8">
        {/* Header */}
        <motion.div variants={item} className="text-center space-y-2">
          <h1 className="text-display text-foreground" data-testid="demo-title">
            SwiftUI Component Library
          </h1>
          <p className="text-body text-muted-foreground" data-testid="demo-subtitle">
            Interactive showcase of all AXLE components
          </p>
        </motion.div>

        {/* Cards */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="default" data-testid="card-default">
              <h3 className="text-headline font-semibold mb-2">Default Card</h3>
              <p className="text-body text-muted-foreground">Standard card with border and soft shadow</p>
            </Card>
            <Card variant="elevated" data-testid="card-elevated">
              <h3 className="text-headline font-semibold mb-2">Elevated Card</h3>
              <p className="text-body text-muted-foreground">No border, elevated shadow for depth</p>
            </Card>
            <Card variant="filled" data-testid="card-filled">
              <h3 className="text-headline font-semibold mb-2">Filled Card</h3>
              <p className="text-body text-muted-foreground">Muted background with soft shadow</p>
            </Card>
          </div>
        </motion.section>

        {/* Buttons */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" data-testid="button-primary">
              Primary Button
            </Button>
            <Button variant="secondary" data-testid="button-secondary">
              Secondary Button
            </Button>
            <Button variant="ghost" data-testid="button-ghost">
              Ghost Button
            </Button>
            <Button variant="destructive" data-testid="button-destructive">
              Destructive Button
            </Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button size="sm" data-testid="button-small">Small</Button>
            <Button size="default" data-testid="button-default">Default</Button>
            <Button size="lg" data-testid="button-large">Large</Button>
          </div>
        </motion.section>

        {/* Segmented Control */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Segmented Control</h2>
          <SegmentedControl 
            value={segmentValue} 
            onValueChange={setSegmentValue}
            data-testid="segmented-control"
          >
            <Segment value="design">Design</Segment>
            <Segment value="code">Code</Segment>
            <Segment value="test">Test</Segment>
          </SegmentedControl>
          <p className="text-caption text-muted-foreground">
            Selected: {segmentValue}
          </p>
        </motion.section>

        {/* Chips */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Chips</h2>
          <div className="flex flex-wrap gap-2">
            <Chip variant="default" data-testid="chip-default">Default</Chip>
            <Chip variant="primary" data-testid="chip-primary">Primary</Chip>
            <Chip variant="accent" data-testid="chip-accent">Accent</Chip>
            <Chip variant="success" data-testid="chip-success">Success</Chip>
            <Chip variant="warning" data-testid="chip-warning">Warning</Chip>
            <Chip variant="destructive" data-testid="chip-destructive">Error</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip removable onRemove={() => {}} data-testid="chip-removable">
              Removable
            </Chip>
            <Chip 
              interactive 
              onClick={() => {}}
              data-testid="chip-interactive"
            >
              Interactive
            </Chip>
          </div>
        </motion.section>

        {/* Fields */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Form Fields</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field
              label="Exercise Name"
              placeholder="Enter exercise name"
              assistiveText="Choose a descriptive name"
              data-testid="field-normal"
            />
            <Field
              label="Required Field"
              placeholder="This field is required"
              required
              value={fieldValue}
              onChange={handleFieldChange}
              error={fieldError}
              data-testid="field-required"
            />
            <Field
              variant="filled"
              label="Filled Variant"
              placeholder="Filled background style"
              data-testid="field-filled"
            />
            <Field
              label="Disabled Field"
              placeholder="Cannot edit this field"
              disabled
              data-testid="field-disabled"
            />
          </div>
        </motion.section>

        {/* Stat Badges */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Stat Badges</h2>
          <div className="flex flex-wrap gap-4">
            <StatBadge 
              variant="default" 
              value="13" 
              label="Days"
              icon={<Star className="h-4 w-4" />}
              data-testid="stat-badge-default"
            />
            <StatBadge 
              variant="primary" 
              value="42" 
              label="Workouts"
              icon={<Activity className="h-4 w-4" />}
              data-testid="stat-badge-primary"
            />
            <StatBadge 
              variant="success" 
              value="95%" 
              label="Success Rate"
              icon={<CheckCircle className="h-4 w-4" />}
              data-testid="stat-badge-success"
            />
            <StatBadge 
              variant="warning" 
              value="2" 
              label="Missed Days"
              icon={<Clock className="h-4 w-4" />}
              data-testid="stat-badge-warning"
            />
          </div>
        </motion.section>

        {/* Metric Cards */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Metric Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              variant="default"
              title="Total Workouts"
              value="156"
              change={12.5}
              changeLabel="vs last month"
              icon={<Activity className="h-5 w-5" />}
              data-testid="metric-card-default"
            />
            <MetricCard
              variant="elevated"
              title="Personal Records"
              value="23"
              change={-2.1}
              changeLabel="vs last month"
              icon={<Trophy className="h-5 w-5" />}
              data-testid="metric-card-elevated"
            />
            <MetricCard
              variant="accent"
              title="Current Streak"
              value="7"
              unit="days"
              change={0}
              icon={<Target className="h-5 w-5" />}
              subtitle="Your longest streak this year"
              data-testid="metric-card-accent"
            />
          </div>
        </motion.section>

        {/* Demo TabBar */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Tab Navigation</h2>
          <Card className="p-4">
            <p className="text-body text-muted-foreground mb-4">
              Interactive tab bar with active route highlighting
            </p>
            <TabBar variant="floating">
              <TabItem 
                href="/" 
                icon={<Home className="h-5 w-5" />} 
                label="Home"
              />
              <TabItem 
                href="/search" 
                icon={<Search className="h-5 w-5" />} 
                label="Search"
                badge={3}
              />
              <TabItem 
                href="/add" 
                icon={<Plus className="h-5 w-5" />} 
                label="Add"
              />
              <TabItem 
                href="/profile" 
                icon={<Settings className="h-5 w-5" />} 
                label="Profile"
              />
            </TabBar>
          </Card>
        </motion.section>

        {/* Sheet Modal */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Sheet Modal</h2>
          <div className="space-y-4">
            <Button onClick={() => setSheetOpen(true)} data-testid="open-sheet">
              Open Sheet Modal
            </Button>
            
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetHeader>
                <SheetTitle>Create New Workout</SheetTitle>
                <SheetDescription>
                  Add a new workout to your training routine. Fill in the details below.
                </SheetDescription>
              </SheetHeader>
              
              <SheetContent onClose={() => setSheetOpen(false)}>
                <div className="space-y-4">
                  <Field
                    label="Workout Name"
                    placeholder="Enter workout name"
                    required
                  />
                  <Field
                    label="Description"
                    placeholder="Describe your workout"
                  />
                  
                  <div className="space-y-2">
                    <label className="text-body font-medium">Category</label>
                    <SegmentedControl value="strength" onValueChange={() => {}}>
                      <Segment value="strength">Strength</Segment>
                      <Segment value="cardio">Cardio</Segment>
                      <Segment value="hiit">HIIT</Segment>
                    </SegmentedControl>
                  </div>
                </div>
              </SheetContent>
              
              <SheetFooter>
                <Button variant="ghost" onClick={() => setSheetOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setSheetOpen(false)}>
                  Create Workout
                </Button>
              </SheetFooter>
            </Sheet>
          </div>
        </motion.section>

        {/* Component Features */}
        <motion.section variants={item} className="space-y-4">
          <h2 className="text-title text-foreground">Features</h2>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-headline font-semibold mb-2 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Accessibility
                </h3>
                <ul className="text-body text-muted-foreground space-y-1">
                  <li>• Keyboard navigation support</li>
                  <li>• ARIA labels and roles</li>
                  <li>• Focus management</li>
                  <li>• Screen reader friendly</li>
                </ul>
              </div>
              <div>
                <h3 className="text-headline font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Design System
                </h3>
                <ul className="text-body text-muted-foreground space-y-1">
                  <li>• SwiftUI-inspired design</li>
                  <li>• Consistent design tokens</li>
                  <li>• Light/dark mode support</li>
                  <li>• Responsive components</li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.section>
      </div>
    </motion.div>
  );
}