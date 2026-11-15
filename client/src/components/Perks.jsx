import { ArmchairIcon, MailCheckIcon, ShieldCheckIcon, ZapIcon } from 'lucide-react';

const PERKS = [
  { icon: ZapIcon, title: 'Book in seconds', text: 'Pick a show and check out in a few taps.' },
  { icon: ArmchairIcon, title: 'Choose your seats', text: 'Live seat map, held for you while you pay.' },
  { icon: ShieldCheckIcon, title: 'Secure payments', text: 'Card payments handled by Stripe.' },
  { icon: MailCheckIcon, title: 'Instant e-tickets', text: 'Confirmation in your inbox right away.' },
];

const Perks = () => (
  <section className="px-6 py-12 md:px-14 lg:px-24">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PERKS.map((perk) => {
        const Icon = perk.icon;
        return (
          <div key={perk.title} className="flex items-start gap-4 rounded-2xl bg-ink-2 p-5 ring-1 ring-line">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary-dull ring-1 ring-primary/25">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">{perk.title}</p>
              <p className="mt-1 text-sm text-gray-400">{perk.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export default Perks;
