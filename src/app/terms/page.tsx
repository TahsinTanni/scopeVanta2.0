import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { PLAN_CURRENCY, TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = { title: "Terms of Service · ScopeVanta" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of ScopeVanta (the &quot;Service&quot;), provided by Mir Taki Tazwar, Toronto, Ontario, Canada (&quot;ScopeVanta&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or using the Service,
        you agree to these Terms on behalf of yourself and the business you represent. If you don&apos;t agree, don&apos;t use the
        Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        ScopeVanta helps service businesses analyze client briefs, scope and price work, generate proposals, share them with
        clients, and track changes. Some features use artificial intelligence (AI) to produce drafts, analysis and suggestions.
      </p>

      <h2>2. Accounts and workspaces</h2>
      <ul>
        <li>You must provide accurate information and keep your login secure. You&apos;re responsible for activity under your account.</li>
        <li>
          Work happens in workspaces. The person who creates a workspace is its Owner and is responsible for its subscription.
          The Owner and Admins can invite and manage members.
        </li>
        <li>You must be at least 18 and able to enter into a binding contract.</li>
      </ul>

      <h2>3. Subscriptions, trial and billing</h2>
      <ul>
        <li>
          Paid features require a subscription. Plans are billed monthly in {PLAN_CURRENCY}, in advance, to the card saved on the
          workspace through our payment processor, Square. Prices and plan limits are shown on our pricing page and in the app.
        </li>
        <li>
          First-time subscribers get a {TRIAL_DAYS}-day free trial. Unless you cancel before it ends, your card is charged the plan
          price when the trial ends and every month after that. Workspaces that have subscribed before don&apos;t get another trial.
        </li>
        <li>
          You can cancel at any time from Plan &amp; Billing. See our <Link href="/refunds">Cancellation &amp; Refund Policy</Link>{" "}
          for what happens when you cancel.
        </li>
        <li>If a payment fails, AI features are paused until the overdue invoice is paid.</li>
        <li>Prices exclude applicable taxes, which are added where required.</li>
        <li>We may change prices with at least 30 days&apos; notice; changes apply from your next billing period.</li>
      </ul>

      <h2>4. Usage limits</h2>
      <p>
        Plans include a monthly number of new proposals, and AI features are subject to fair-use limits to keep the Service
        reliable for everyone. We may pause AI features for a workspace that exceeds these limits.
      </p>

      <h2>5. Your content</h2>
      <ul>
        <li>
          You keep ownership of everything you put into the Service — briefs, client details, documents, rates and proposals
          (&quot;Your Content&quot;) — and of the proposals and other outputs generated for you.
        </li>
        <li>
          You give us permission to store, process and transmit Your Content only as needed to run the Service for you, including
          sending it to our AI and infrastructure providers (see our <Link href="/privacy">Privacy Policy</Link>).
        </li>
        <li>You confirm you have the right to upload Your Content, including any information about your clients.</li>
      </ul>

      <h2>6. AI-generated content</h2>
      <p>
        AI output can be inaccurate or incomplete. Proposals, prices, risk scores and other suggestions are drafts to help you — they
        are not professional, legal or financial advice. You are responsible for reviewing everything before you rely on it or send
        it to a client.
      </p>

      <h2>7. Share links</h2>
      <p>
        When you share a proposal or discovery link, anyone who has the link can open it until it expires or you revoke it, and your
        client&apos;s responses (such as accepting a proposal) are recorded in your workspace.
      </p>

      <h2>8. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for anything unlawful, fraudulent or harmful;</li>
        <li>upload content you don&apos;t have the right to share, or malware;</li>
        <li>try to access other customers&apos; data, probe or disrupt the Service, or get around its limits or security;</li>
        <li>resell the Service, or copy or reverse-engineer it, except where the law allows.</li>
      </ul>

      <h2>9. Suspension and termination</h2>
      <p>
        You can stop using the Service at any time. We may suspend or close a workspace that breaks these Terms or puts the Service
        or other customers at risk, and will tell you why where we reasonably can. After an account is closed we may delete its data
        as described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the extent the law allows, we disclaim all warranties,
        including fitness for a particular purpose and that the Service will be uninterrupted or error-free.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the extent the law allows, ScopeVanta is not liable for indirect, incidental or consequential losses, lost profits or lost
        business, and our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.
        Nothing in these Terms limits rights you have under consumer protection laws that can&apos;t be waived.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms. For significant changes we&apos;ll give notice in the app or by email before they take effect.
        Continuing to use the Service after that means you accept the new Terms.
      </p>

      <h2>13. Governing law</h2>
      <p>These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there.</p>

      <h2>14. Contact</h2>
      <p>Questions about these Terms: mirtaki123@gmail.com.</p>
    </LegalPage>
  );
}
