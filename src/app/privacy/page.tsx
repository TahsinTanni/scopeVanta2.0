import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · ScopeVanta" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains how [Legal business name] (&quot;ScopeVanta&quot;, &quot;we&quot;) collects, uses and protects personal
        information when you use ScopeVanta. We handle personal information in line with Canada&apos;s Personal Information
        Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy laws.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your name, email address and sign-in details, and the workspaces you belong to.</li>
        <li>
          <strong>Workspace content:</strong> what you and your team put into ScopeVanta — company profile and logo, client records,
          briefs, proposals, rates, uploaded documents and support conversations. This can include personal information about your
          clients, which you control.
        </li>
        <li>
          <strong>Billing information:</strong> your plan and subscription status. Card details are entered directly into our payment
          processor&apos;s (Square&apos;s) secure form — we never receive or store your full card number.
        </li>
        <li>
          <strong>Share-link responses:</strong> when your client responds through a share link, the name, email and answers they
          provide.
        </li>
        <li><strong>Usage information:</strong> basic records of how the Service is used, such as feature usage and error logs.</li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>to provide, secure and support the Service, including generating AI output for your workspace;</li>
        <li>to process payments and manage your subscription;</li>
        <li>to prevent abuse and enforce usage limits;</li>
        <li>to communicate with you about your account and important changes.</li>
      </ul>
      <p>We don&apos;t sell personal information, and we don&apos;t use your workspace content to advertise to you.</p>

      <h2>3. Service providers</h2>
      <p>We share information only with providers that help us run the Service, under agreements that protect it:</p>
      <ul>
        <li><strong>Clerk</strong> — sign-in and team management;</li>
        <li><strong>Square</strong> — payments and subscriptions;</li>
        <li><strong>Anthropic</strong> — AI processing of the content you ask us to analyze or generate from;</li>
        <li><strong>Vercel</strong> — hosting and file storage;</li>
        <li><strong>Supabase</strong> — database hosting.</li>
      </ul>
      <p>
        Some of these providers store or process information outside Canada, including in the United States, where it may be
        accessible to authorities under local law. [Confirm the data regions you use.]
      </p>

      <h2>4. How long we keep it</h2>
      <p>
        We keep workspace content while your account is active. When a workspace is deleted, we delete its content, including
        uploaded files, within 30 days, except where we must keep records (for example, billing records) for legal or tax reasons.
        Backups are overwritten on a rolling basis.
      </p>

      <h2>5. Security</h2>
      <p>
        We protect information with measures such as encrypted connections, access controls that keep each workspace&apos;s data
        separate, private storage for uploaded documents, and two-factor authentication for staff access. No system is perfectly
        secure, and we&apos;ll notify you of a breach affecting your information as required by law.
      </p>

      <h2>6. Your choices and rights</h2>
      <p>
        You can access and update most of your information in the app. You can ask us to access, correct or delete your personal
        information, or withdraw consent (which may mean you can no longer use the Service), by contacting [Contact email]. If
        you&apos;re not satisfied with our response, you can contact the Office of the Privacy Commissioner of Canada.
      </p>

      <h2>7. Your clients&apos; information</h2>
      <p>
        When you add information about your clients, you&apos;re responsible for having the right to share it with us, and we process
        it on your behalf only to provide the Service.
      </p>

      <h2>8. Changes</h2>
      <p>We&apos;ll post updates here and notify you of significant changes.</p>

      <h2>9. Contact</h2>
      <p>Privacy questions or requests: [Contact email], [Business address]. [Name or title of your privacy officer.]</p>
    </LegalPage>
  );
}
