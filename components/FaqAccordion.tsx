"use client";

import { useState } from "react";

export type FaqItem = {
  q: string;
  a: string;
};

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="lp-faq">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={index} className={`lp-faq-item${isOpen ? " open" : ""}`}>
            <h3 className="lp-faq-heading">
              <button
                type="button"
                className="lp-faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{item.q}</span>
                <span className="lp-chevron" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
            </h3>
            <div className={`lp-faq-a${isOpen ? " open" : ""}`}>
              <div>
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
