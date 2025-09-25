import Section from "@/components/layout/Section";
import { PageTitle } from "@/components/typography/Heading";
import { BackButton } from "@/components/ui/back-button";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BackButton />
        
        <Section>
          <PageTitle>Terms of Service</PageTitle>
          
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2>Acceptance of Terms</h2>
            <p>
              By accessing and using AXLE, you accept and agree to be bound by the terms and 
              provision of this agreement. If you do not agree to abide by the above, please 
              do not use this service.
            </p>

            <h2>Description of Service</h2>
            <p>
              AXLE is a fitness tracking application that helps users log workouts, track personal 
              records, view achievements, and analyze fitness progress. The service includes 
              AI-powered workout suggestions and health metrics computation.
            </p>

            <h2>User Responsibilities</h2>
            <p>
              You are responsible for:
            </p>
            <ul>
              <li>Maintaining the confidentiality of your account information</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and truthful information</li>
              <li>Using the service in compliance with applicable laws</li>
            </ul>

            <h2>Health and Safety Disclaimer</h2>
            <p>
              AXLE is not intended to diagnose, treat, cure, or prevent any disease. The information 
              provided by the app is for informational purposes only and should not replace 
              professional medical advice. Consult with a healthcare provider before starting any 
              fitness program.
            </p>

            <h2>Limitation of Liability</h2>
            <p>
              AXLE shall not be liable for any indirect, incidental, special, consequential, or 
              punitive damages, including without limitation, loss of profits, data, use, goodwill, 
              or other intangible losses.
            </p>

            <h2>Termination</h2>
            <p>
              We may terminate or suspend your account and bar access to the service immediately, 
              without prior notice or liability, under our sole discretion, for any reason whatsoever 
              and without limitation.
            </p>

            <h2>Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. If a revision is 
              material, we will provide at least 30 days notice prior to any new terms taking effect.
            </p>

            <h2>Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us through the app.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}