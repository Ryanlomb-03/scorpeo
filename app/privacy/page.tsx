"use client";
import { useRouter } from "next/navigation";

export default function Privacy() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7"/>
            <path d="M19 12H5"/>
          </svg>
          Back
        </button>
        <h1 className="text-3xl font-bold mb-6">Scorpio Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Information We Collect</h2>
            <p>We may collect:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>User input (messages, prompts)</li>
              <li>Usage data (features used, interactions)</li>
              <li>Technical data (device type, browser)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. How We Use Information</h2>
            <p>We use data to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Provide and improve the service</li>
              <li>Respond to user requests</li>
              <li>Enhance system performance</li>
              <li>Develop new features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. AI Processing</h2>
            <p>Your inputs may be processed by third-party AI providers to generate responses. We do not guarantee that all processing occurs on our own servers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. Data Storage</h2>
            <p>We may store:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Conversation data (temporarily or for improvement)</li>
              <li>Anonymized usage patterns</li>
            </ul>
            <p className="mt-2">We aim to minimize personally identifiable information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Anonymization</h2>
            <p>We may process data in anonymized or aggregated form to improve system performance and features.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Data Sharing</h2>
            <p>We do not sell personal data. We may share limited data with:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>AI service providers</li>
              <li>Infrastructure providers</li>
            </ul>
            <p className="mt-2">Only as needed to operate the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">7. Security</h2>
            <p>We implement reasonable safeguards to protect data, but no system is completely secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">8. User Control</h2>
            <p>Users may:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Stop using the service at any time</li>
              <li>Avoid sharing personal or sensitive information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">9. Changes to Policy</h2>
            <p>We may update this Privacy Policy. Continued use means acceptance of updates.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">10. Contact</h2>
            <p>For questions, contact: codedwaves01@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
