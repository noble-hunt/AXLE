import { motion } from "framer-motion";
import { fadeIn, slideUp, container, item } from "@/lib/motion-variants";

export default function TokensDemo() {
  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-background p-6 space-y-8"
      data-testid="tokens-demo-page"
    >
      {/* Header */}
      <motion.div variants={item} className="text-center space-y-2">
        <h1 className="text-display text-foreground" data-testid="demo-title">
          SwiftUI Design System
        </h1>
        <p className="text-body text-muted-foreground" data-testid="demo-subtitle">
          AXLE Design Tokens & Components Demo
        </p>
      </motion.div>

      {/* Typography Scale */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-typography">
          Typography Scale
        </h2>
        <div className="bg-card shadow-card rounded-xl p-6 space-y-4">
          <div className="text-display text-foreground" data-testid="text-display">
            Display (34/40/700) - Hero Headlines
          </div>
          <div className="text-title text-foreground" data-testid="text-title">
            Title (28/34/700) - Section Headers
          </div>
          <div className="text-headline text-foreground" data-testid="text-headline">
            Headline (22/28/600) - Important Content
          </div>
          <div className="text-body text-foreground" data-testid="text-body">
            Body (16/24/500) - Regular text content and descriptions
          </div>
          <div className="text-caption text-muted-foreground" data-testid="text-caption">
            Caption (13/18/500) - Labels and metadata
          </div>
        </div>
      </motion.section>

      {/* Color Tokens */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-colors">
          Color Tokens
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2" data-testid="color-primary">
            <div className="bg-primary h-16 rounded-md shadow-soft"></div>
            <p className="text-caption text-foreground">Primary</p>
          </div>
          <div className="space-y-2" data-testid="color-accent">
            <div className="bg-accent h-16 rounded-md shadow-soft"></div>
            <p className="text-caption text-foreground">Accent</p>
          </div>
          <div className="space-y-2" data-testid="color-surface">
            <div className="bg-surface border border-border h-16 rounded-md shadow-soft"></div>
            <p className="text-caption text-foreground">Surface</p>
          </div>
          <div className="space-y-2" data-testid="color-card">
            <div className="bg-card h-16 rounded-md shadow-soft"></div>
            <p className="text-caption text-foreground">Card</p>
          </div>
          <div className="space-y-2" data-testid="color-muted">
            <div className="bg-muted h-16 rounded-md shadow-soft"></div>
            <p className="text-caption text-foreground">Muted</p>
          </div>
          <div className="space-y-2" data-testid="color-border">
            <div className="bg-border h-16 rounded-md shadow-soft"></div>
            <p className="text-caption text-foreground">Border</p>
          </div>
        </div>
      </motion.section>

      {/* Spacing Scale */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-spacing">
          Spacing Scale (8pt Grid)
        </h2>
        <div className="bg-card shadow-card rounded-xl p-6 space-y-4">
          {[
            { token: "0.5", value: "2px", class: "w-0.5" },
            { token: "1", value: "4px", class: "w-1" },
            { token: "1.5", value: "6px", class: "w-1.5" },
            { token: "2", value: "8px", class: "w-2" },
            { token: "3", value: "12px", class: "w-3" },
            { token: "4", value: "16px", class: "w-4" },
            { token: "5", value: "20px", class: "w-5" },
            { token: "6", value: "24px", class: "w-6" },
            { token: "8", value: "32px", class: "w-8" },
            { token: "10", value: "40px", class: "w-10" },
          ].map((spacing) => (
            <div key={spacing.token} className="flex items-center space-x-4" data-testid={`spacing-${spacing.token}`}>
              <div className={`bg-primary h-4 ${spacing.class} rounded`}></div>
              <span className="text-body text-foreground">
                {spacing.token} = {spacing.value}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Border Radius */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-radius">
          Border Radius
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2" data-testid="radius-md">
            <div className="bg-primary h-16 rounded-md"></div>
            <p className="text-caption text-foreground">md (12px)</p>
          </div>
          <div className="space-y-2" data-testid="radius-xl">
            <div className="bg-primary h-16 rounded-xl"></div>
            <p className="text-caption text-foreground">xl (16px)</p>
          </div>
          <div className="space-y-2" data-testid="radius-2xl">
            <div className="bg-primary h-16 rounded-2xl"></div>
            <p className="text-caption text-foreground">2xl (24px)</p>
          </div>
        </div>
      </motion.section>

      {/* Shadows */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-shadows">
          Shadow Utilities
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2" data-testid="shadow-soft-demo">
            <div className="bg-card h-16 rounded-xl shadow-soft flex items-center justify-center">
              <span className="text-body text-card-foreground">shadow-soft</span>
            </div>
            <p className="text-caption text-muted-foreground">Minimal elevation</p>
          </div>
          <div className="space-y-2" data-testid="shadow-card-demo">
            <div className="bg-card h-16 rounded-xl shadow-card flex items-center justify-center">
              <span className="text-body text-card-foreground">shadow-card</span>
            </div>
            <p className="text-caption text-muted-foreground">Card elevation</p>
          </div>
        </div>
      </motion.section>

      {/* Gradients */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-gradients">
          Gradient Utilities
        </h2>
        <div className="space-y-4">
          <div className="space-y-2" data-testid="gradient-soft-demo">
            <div className="soft-gradient h-20 rounded-xl flex items-center justify-center shadow-soft">
              <span className="text-headline text-foreground">soft-gradient</span>
            </div>
            <p className="text-caption text-muted-foreground">
              Subtle surface-to-muted gradient for backgrounds
            </p>
          </div>
        </div>
      </motion.section>

      {/* Framer Motion Demo */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-animations">
          Framer Motion Variants
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            variants={fadeIn}
            className="bg-card shadow-card rounded-xl p-6 space-y-2"
            data-testid="animation-fadein"
          >
            <h3 className="text-headline text-card-foreground">fadeIn</h3>
            <p className="text-body text-muted-foreground">
              Smooth opacity transition with SwiftUI easing
            </p>
          </motion.div>
          <motion.div
            variants={slideUp}
            className="bg-card shadow-card rounded-xl p-6 space-y-2"
            data-testid="animation-slideup"
          >
            <h3 className="text-headline text-card-foreground">slideUp</h3>
            <p className="text-body text-muted-foreground">
              Slide from bottom with natural spring motion
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Implementation Examples */}
      <motion.section variants={item} className="space-y-4">
        <h2 className="text-title text-foreground" data-testid="section-examples">
          Implementation Examples
        </h2>
        <div className="bg-card shadow-card rounded-xl p-6 space-y-6">
          {/* Card Example */}
          <div className="space-y-2" data-testid="example-card">
            <h3 className="text-headline text-card-foreground">Card Component</h3>
            <div className="bg-surface shadow-soft rounded-xl p-4 border border-border">
              <h4 className="text-headline text-foreground mb-2">Workout Summary</h4>
              <p className="text-body text-muted-foreground mb-4">
                Today's training session with proper design tokens
              </p>
              <div className="flex gap-3">
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-body font-medium shadow-soft">
                  View Details
                </button>
                <button className="bg-surface border border-border text-foreground px-4 py-2 rounded-md text-body shadow-soft">
                  Share
                </button>
              </div>
            </div>
          </div>

          {/* Form Example */}
          <div className="space-y-2" data-testid="example-form">
            <h3 className="text-headline text-card-foreground">Form Elements</h3>
            <div className="space-y-3">
              <div>
                <label className="text-body text-foreground block mb-1">Exercise Name</label>
                <input
                  type="text"
                  placeholder="Enter exercise name"
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-body text-foreground shadow-soft focus:ring-2 focus:ring-primary"
                  data-testid="example-input"
                />
              </div>
              <div>
                <label className="text-body text-foreground block mb-1">Notes</label>
                <textarea
                  placeholder="Add your notes here..."
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-body text-foreground shadow-soft h-20"
                  data-testid="example-textarea"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}