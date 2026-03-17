"use client";

import { useState } from "react";
import Link from "next/link";
import { NeuralStackLogo } from "@/components/ui/NeuralStackLogo";
import { MathewTerminal } from "@/components/ui/MathewTerminal";

export default function HomePage() {
  const [showMathew, setShowMathew] = useState(false);

  return (
    <main className="deck-home">
      <div className="deck-home-glow deck-home-glow--left" />
      <div className="deck-home-glow deck-home-glow--right" />

      <section className="deck-home-hero">
        <div className="deck-home-logo-wrap">
          <NeuralStackLogo size={86} interactive animate density="high" />
        </div>
        <h1 className="deck-home-title">Stack Capital</h1>
        <p className="deck-home-tagline">
          A private investment firm taking a structural approach to long-horizon
          capital deployment across technology infrastructure and critical supply chains
        </p>
      </section>

      <nav className="deck-home-nav">
        <Link className="deck-home-nav-link" href="/deck-react">
          Investment Thesis
        </Link>
        <span className="deck-home-nav-sep" />
        <Link className="deck-home-nav-link" href="/deck-react-short">
          Pitch Deck
        </Link>
        <span className="deck-home-nav-sep" />
        <Link className="deck-home-nav-link" href="/investor-login">
          Investor Login
        </Link>
        <span className="deck-home-nav-sep" />
        <Link className="deck-home-nav-link" href="/operator/login">
          Intelligence
        </Link>
      </nav>

      <button
        className="deck-home-mathew-line"
        onClick={() => setShowMathew(true)}
        type="button"
      >
        <span className="deck-home-mathew-dot" />
        <span className="deck-home-mathew-line-text">
          Mathew &mdash; AI Research Demo
        </span>
        <span className="deck-home-mathew-line-arrow">&rarr;</span>
      </button>

      {showMathew && <MathewTerminal onClose={() => setShowMathew(false)} />}
    </main>
  );
}
