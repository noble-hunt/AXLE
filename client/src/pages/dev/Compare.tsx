import { useState } from "react";
import { Card } from "@/components/swift/card";
import { Button } from "@/components/swift/button";
import { Field } from "@/components/swift/field";
import {
  SegmentedControl,
  Segment,
} from "@/components/swift/segmented-control";
import { ExternalLink, Eye } from "lucide-react";

const REFERENCE_IMAGES = Array.from(
  { length: 17 },
  (_, i) => `ref-${String(i + 1).padStart(2, "0")}.png`,
);

const ROUTES = [
  { value: "/", label: "Home" },
  { value: "/workout", label: "Workout" },
  { value: "/history", label: "History" },
  { value: "/prs", label: "Personal Records" },
  { value: "/achievements", label: "Achievements" },
  { value: "/reports", label: "Reports" },
  { value: "/generate-workout", label: "Generate Workout" },
  { value: "/dev/components", label: "Components Demo" },
  { value: "/dev/tokens", label: "Design Tokens" },
];

export default function Compare() {
  const [selectedRef, setSelectedRef] = useState<string>("ref-01.png");
  const [targetRoute, setTargetRoute] = useState<string>("/");
  const [customRoute, setCustomRoute] = useState<string>("");
  const [useCustomRoute, setUseCustomRoute] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  const handleStartComparison = () => {
    const route = useCustomRoute ? customRoute : targetRoute;
    const compareUrl = `${route}?overlay=${selectedRef}`;
    window.open(compareUrl, "_blank", "width=1200,height=800");
    setIsComparing(true);
  };

  const handleOpenInIframe = () => {
    setIsComparing(true);
  };

  const getIframeSrc = () => {
    const route = useCustomRoute ? customRoute : targetRoute;
    return `${route}?overlay=${selectedRef}`;
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">UI Reference Comparison</h1>
        <p className="text-muted-foreground">
          Compare your implementation against reference designs using overlays
          and side-by-side views.
        </p>
      </div>

      {!isComparing ? (
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Configure Comparison</h2>

            {/* Reference Image Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Reference Image</label>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                {REFERENCE_IMAGES.map((image) => (
                  <button
                    key={image}
                    onClick={() => setSelectedRef(image)}
                    className={`
                      aspect-square rounded-lg border-2 transition-all duration-200
                      flex items-center justify-center text-xs font-medium
                      hover:border-primary/50 hover:bg-muted
                      ${
                        selectedRef === image
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }
                    `}
                    data-testid={`ref-${image}`}
                  >
                    {image.split(".")[0]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected: <strong>{selectedRef}</strong>
              </p>
            </div>

            {/* Route Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Target Route</label>
                <SegmentedControl
                  value={useCustomRoute ? "custom" : "preset"}
                  onValueChange={(value) =>
                    setUseCustomRoute(value === "custom")
                  }
                  data-testid="route-selector"
                >
                  <Segment value="preset">Preset Routes</Segment>
                  <Segment value="custom">Custom Route</Segment>
                </SegmentedControl>
              </div>

              {useCustomRoute ? (
                <div className="space-y-2">
                  <Field
                    value={customRoute}
                    onChange={(e) => setCustomRoute(e.target.value)}
                    placeholder="/custom/route"
                    assistiveText="Enter a custom route path (e.g., /custom/page)"
                    data-testid="custom-route-input"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ROUTES.map((route) => (
                    <button
                      key={route.value}
                      onClick={() => setTargetRoute(route.value)}
                      className={`
                        p-3 rounded-lg border-2 transition-all duration-200 text-left
                        hover:border-primary/50 hover:bg-muted
                        ${
                          targetRoute === route.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border"
                        }
                      `}
                      data-testid={`route-${route.value.replace("/", "")}`}
                    >
                      <div className="font-medium text-sm">{route.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {route.value}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Preview URL</label>
              <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                {getIframeSrc()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleStartComparison}
                className="flex-1"
                data-testid="open-in-new-tab"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
              <Button
                onClick={handleOpenInIframe}
                variant="secondary"
                className="flex-1"
                data-testid="open-in-iframe"
              >
                <Eye className="w-4 h-4 mr-2" />
                Side-by-Side View
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        // Side-by-side comparison view
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Side-by-Side Comparison</h2>
            <Button
              onClick={() => setIsComparing(false)}
              variant="secondary"
              data-testid="back-to-config"
            >
              Back to Configuration
            </Button>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px]">
              {/* Reference Image */}
              <div className="border-r border-border bg-muted/20">
                <div className="p-4 border-b border-border">
                  <h3 className="font-medium text-sm">
                    Reference: {selectedRef}
                  </h3>
                </div>
                <div className="p-4 h-[600px] flex items-center justify-center">
                  <img
                    src={`/ui_ref/${selectedRef}`}
                    alt={`Reference ${selectedRef}`}
                    className="max-w-full max-h-full object-contain border border-border rounded"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="text-center text-muted-foreground">
                            <p>Reference image not found</p>
                            <p class="text-xs mt-1">${selectedRef}</p>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
              </div>

              {/* Live Implementation */}
              <div>
                <div className="p-4 border-b border-border">
                  <h3 className="font-medium text-sm">
                    Implementation: {useCustomRoute ? customRoute : targetRoute}
                  </h3>
                </div>
                <iframe
                  src={getIframeSrc()}
                  className="w-full h-[600px] border-0"
                  title="Implementation Preview"
                  data-testid="implementation-iframe"
                />
              </div>
            </div>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              The implementation iframe includes the overlay for direct
              comparison.
            </p>
            <p>
              Use the overlay controls in the iframe to adjust opacity, scale,
              and position.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
