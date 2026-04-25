import { Phone } from "lucide-react";
import { CopyButton } from "@/components/leads/CopyButton";
import { LeadCallButton } from "@/components/leads/LeadCallButton";

type CallReadyBlockProps = {
  leadId: string;
  leadName: string;
  company: string | null;
  jobTitle: string | null;
  phone: string;
  phoneDisabled?: boolean;
  openingLine: string | null;
  bestCallWindow: string | null;
};

export function CallReadyBlock({
  leadId,
  leadName,
  company,
  jobTitle,
  phone,
  phoneDisabled,
  openingLine,
  bestCallWindow
}: CallReadyBlockProps) {
  const telHref = `tel:${phone.replace(/\s+/g, "")}`;
  const hook = openingLine?.trim() || null;
  const window = bestCallWindow?.trim() || null;

  return (
    <section className="call-ready">
      <div className="call-ready__main">
        <div className="call-ready__title">
          <strong>{leadName}</strong>
          {jobTitle ? <span>{jobTitle}</span> : null}
          {company ? <span>· {company}</span> : null}
        </div>
        <a className="call-ready__phone" href={telHref}>
          <Phone size={20} />
          {phone}
        </a>
        {hook ? (
          <div className="call-ready__hook">
            <span className="call-ready__hook-label">Opening line</span>
            <p>{hook}</p>
            <div>
              <CopyButton text={hook} label="Copiar opening line" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="call-ready__side">
        <LeadCallButton leadId={leadId} leadLabel={leadName} phone={phone} disabled={phoneDisabled} />
        {window ? (
          <div className="call-ready__meta">
            <span>Millor hora</span>
            <strong>{window}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}
