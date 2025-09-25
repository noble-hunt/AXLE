import Section from "@/components/layout/Section";
import { PageTitle } from "@/components/typography/Heading";
import { BackButton } from "@/components/ui/back-button";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BackButton />
        
        <Section>
          <PageTitle>Privacy Policy</PageTitle>
          
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2>Information We Collect</h2>
            <p>
              AXLE collects information you provide directly to us, such as when you create an account, 
              log workouts, or contact us for support. This may include your name, email address, 
              fitness data, and other information you choose to provide.
            </p>

            <h2>How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul>
              <li>Provide, maintain, and improve our fitness tracking services</li>
              <li>Generate personalized workout recommendations</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>

            <h2>Information Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties 
              without your consent, except as described in this policy. We may share aggregated, 
              non-personally identifiable information for research and analytics purposes.
            </p>

            <h2>Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal 
              information against unauthorized access, alteration, disclosure, or destruction.
            </p>

            <h2>Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal information. You may also 
              request that we restrict or stop processing your data. Contact us to exercise these rights.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us through the app 
              or by email.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}