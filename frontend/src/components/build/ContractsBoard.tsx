import { fmt } from "../../format";
import type { Contract, GameState, Offer } from "../../game/types";

interface ContractsBoardProps {
  state: GameState;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
}

function Badges({ kind, strict, quality }: { kind: "baseline" | "burst"; strict: boolean; quality?: boolean }) {
  return (
    <span className="badges">
      <span className={"badge badge-" + kind}>{kind}</span>
      <span className={"badge " + (strict ? "badge-strict" : "badge-loose")}>
        {strict ? "strict SLA" : "loose"}
      </span>
      {quality && <span className="badge badge-premium">premium</span>}
    </span>
  );
}

function OfferCard({ offer, onAccept, onDecline }: { offer: Offer; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="contract offer">
      <div className="contract-head">
        <span className="contract-name">{offer.name}</span>
        <Badges kind={offer.kind} strict={offer.strict} quality={offer.quality} />
      </div>
      <div className="contract-terms ds-code">
        ~{fmt.int(offer.baseDemand)} req/s · {fmt.money2(offer.price)}/req
        {offer.penalty > 0 ? ` · −${fmt.money2(offer.penalty)}/breach` : ""}
      </div>
      <div className="contract-actions">
        <button type="button" className="btn primary sm" onClick={onAccept}>
          Sign
        </button>
        <button type="button" className="btn sm" onClick={onDecline}>
          Pass
        </button>
      </div>
    </div>
  );
}

function ActiveCard({ c }: { c: Contract }) {
  return (
    <div className={"contract active status-" + c.status}>
      <div className="contract-head">
        <span className="contract-name">{c.name}</span>
        <span className={"status-dot status-" + c.status} />
      </div>
      <div className="contract-terms ds-code">
        {fmt.int(c.served)}/{fmt.int(c.demand)} req/s · {fmt.money2(c.price)}/req
      </div>
      <div className="health-bar">
        <div className={"health-fill status-" + c.status} style={{ width: `${Math.max(0, Math.min(1, c.health)) * 100}%` }} />
      </div>
    </div>
  );
}

export function ContractsBoard({ state, onAccept, onDecline }: ContractsBoardProps) {
  return (
    <section className="panel contracts">
      <div className="contracts-section">
        <div className="contracts-head ds-label">offers</div>
        {state.offers.length === 0 ? (
          <p className="contracts-empty ds-code">No offers right now — build capacity and wait.</p>
        ) : (
          state.offers.map((o) => (
            <OfferCard key={o.id} offer={o} onAccept={() => onAccept(o.id)} onDecline={() => onDecline(o.id)} />
          ))
        )}
      </div>

      <div className="contracts-section">
        <div className="contracts-head ds-label">active contracts</div>
        {state.contracts.length === 0 ? (
          <p className="contracts-empty ds-code">Sign an offer to start earning.</p>
        ) : (
          state.contracts.map((c) => <ActiveCard key={c.id} c={c} />)
        )}
      </div>
    </section>
  );
}
