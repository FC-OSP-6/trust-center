/* ================================
  TL;DR  --> A button that when clicked expands to FAQs in the form of separate dropdowns for each question 
      1. Each FAQ will have a button that will expand or shrink to show the answer to that question
================================ */
// import React from "react";

import { useState } from 'react';

export default function Faqs() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <aon-faq-card
        question="Do you feel secure?"
        answer="Lorem ipsum dolor sit amet"
      />
      <aon-faq-card
        question="Do you feel secure?"
        answer="Lorem ipsum dolor sit amet"
      />
      <aon-faq-card
        question="Do you feel secure?"
        answer="Lorem ipsum dolor sit amet"
      />
    </section>
  );
}
