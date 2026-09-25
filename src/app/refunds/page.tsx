import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { PLAN_CURRENCY, TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = { title: "Cancellation & Refund Policy · ScopeVanta" };

export default function RefundsPage() {
  return (
    <LegalPage title="Cancellation & Refund Policy">
      <h2>Free trial</h2>
      <p>
        First-time subscribers get a {TRIAL_DAYS}-day free trial. A card is required to start it, but nothing is charged during the
        trial. If you cancel during the trial, you won&apos;t be charged and you keep access until the trial ends.
      </p>

      <h2>How to cancel</h2>
      <p>
        The workspace Owner can cancel at any time in <strong>Plan &amp; Billing → Cancel subscription</strong>. No email or phone call
        is needed. Billing stops right away — you won&apos;t be charged again.
      </p>

      <h2>After you cancel</h2>
      <ul>
        <li>You keep access until the end of the billing period you&apos;ve already paid for (or the end of your free trial).</li>
        <li>After that, AI features stop; your workspace data stays available to view.</li>
        <li>You can subscribe again at any time. Returning subscribers are charged from day one, without a new free trial.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        Subscriptions are billed monthly in {PLAN_CURRENCY}, in advance. We don&apos;t refund partial months or unused time after you
        cancel, except where the law requires it. If you were charged in error — for example, a duplicate charge, or a charge after
        you cancelled — contact us within 30 days at [Contact email] and we&apos;ll refund it to the original card.
      </p>

      <h2>Failed payments</h2>
      <p>
        If a monthly payment fails, AI features are paused and the Owner can pay the overdue invoice and update the card from Plan
        &amp; Billing. Access returns automatically once the invoice is paid.
      </p>

      <h2>Contact</h2>
      <p>Billing questions: [Contact email].</p>
    </LegalPage>
  );
}
