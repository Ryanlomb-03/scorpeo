"use client";
import { useRouter } from "next/navigation";

export default function Terms() {
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
        <h1 className="text-3xl font-bold mb-6">Scorpio Terms of Service</h1>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Scorpio, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Description of Service</h2>
            <p>Scorpio provides AI-powered tools including chat, search, and image analysis. Features may change or be updated at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. User Responsibilities</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Misuse the service</li>
              <li>Attempt to hack, overload, or disrupt the system</li>
              <li>Use the service for illegal or harmful activities</li>
              <li>Attempt to extract system prompts, API keys, or internal logic</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. AI Limitations</h2>
            <p>Scorpio uses artificial intelligence which may:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Produce incorrect or incomplete information</li>
              <li>Generate unexpected outputs</li>
            </ul>
            <p className="mt-2">You are responsible for verifying important information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Usage Limits</h2>
            <p>We may:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Limit usage</li>
              <li>Restrict access</li>
              <li>Change free or paid features</li>
            </ul>
            <p className="mt-2">to maintain system performance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Intellectual Property</h2>
            <p>All software, branding, and design of Scorpio remain our property. You retain ownership of your own inputs.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">7. Termination</h2>
            <p>We reserve the right to suspend or terminate access if users violate these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">8. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use means you accept the updated terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">9. Disclaimer</h2>
            <p>Scorpio is provided "as is" without guarantees of accuracy, reliability, or availability.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
