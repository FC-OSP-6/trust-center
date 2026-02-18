/* ================================
  TL;DR  --> A button that when clicked expands to FAQs in the form of separate dropdowns for each question 
      1. Each FAQ will have a button that will expand or shrink to show the answer to that question
================================ */
// import React from "react";

//On the client side

import React, { useEffect, useMemo, useState } from 'react';

import { fetchFaqsConnectionPage } from '../../api';
import type { Faq } from '../../types-frontend';


export default function Faqs() {

  // single expanded boolean cannot support multiple faq items
  // const [expanded, setExpanded] = useState(false);
  // const [expanded, setExpanded] = useState({})

  //Handle Toggle

  // ui state  -->  basic loading/errors for mvp visibility
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // data state  -->  store nodes only (ui cares about the node payload)
  const [items, setItems] = useState<Faq[]>([]);

  // computed view  -->  stable derived list for rendering
  const faqs = useMemo(() => items, [items]);

  useEffect(() => {
    let isActive = true; // guards state updates after unmount

    async function load() {
      setIsLoading(true);
      setErrorText(null);

      try {
        // first page only  -->  enough to prove db + graphql + ui wiring
        const res = await fetchFaqsConnectionPage({ first: 25 });

        // flatten edges -> nodes  -->  simplest ui contract
        const nodes = res.edges.map((e) => e.node);

        if (!isActive) return;
        setItems(nodes);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown faqs fetch error';

        if (!isActive) return;
        setErrorText(msg);
        setItems([]); // keep the visual state deterministic
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    }

    load();

    return () => {
      isActive = false; // cleanup flag
    };
  }, []);

  return (
    <section>
      {/* status text  -->  keeps debugging fast during mvp */}
      <div>
        {isLoading && <p>loading faqs...</p>}
        {errorText && <p>error: {errorText}</p>}
        {!isLoading && !errorText && <p>faqs loaded: {faqs.length}</p>}
      </div>

      {/* render stencil items if custom element supports props, otherwise fallback list is still visible */}
      {faqs.map((f) => (
        <div key={f.id}>
          {/* aon-faq-card props are not typed in types-frontend yet  -->  plain render keeps demo stable */}
          <strong>{f.question}</strong>
          <div>{f.answer}</div>
          <div>{f.category}</div>
          <div>updated: {f.updatedAt}</div>
        </div>
      ))}
    </section>
  );
}



//DeepSeek

/*


import { useState } from 'react';

// FAQ Item Component
const FaqItem = ({ id, question, answer, isExpanded, onToggle }) => {
  return (
    <div className="faq-item">
      <button 
        className="faq-question"
        onClick={() => onToggle(id)}
        aria-expanded={isExpanded}
      >
        <span>{question}</span>
        <span className={`arrow ${isExpand`ed ? 'expanded' : ''}`}>
          ▼
        </span>
      </button>
      {isExpanded && (
        <div className="faq-answer">
          {answer}
        </div>
      )}
    </div>
  );
};


// Main FAQ Component
export default function Faqs() {
  const [expandedItems, setExpandedItems] = useState({});

  const faqData = [
    { id: 1, question: "Do you feel secure?", answer: "CyQu is monitored by Aon's cybersecurity operations through their AC3 team (Aon Cybersecurity Command Center), which functions as SOC equivalent..." },
    { id: 2, question: "Does this software require cookies? What are they used for?", answer: "Cyqu application does not implement cookies for tracking or analytic purposes..." },
    { id: 3, question: "Does this software require cookies? What are they used for?", answer: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." },
    { id: 4, question: "Does this software require cookies? What are they used for?", answer: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum." }
  ];

  const handleToggle = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <section className="faqs-section">
      <h2>Frequently Asked Questions</h2>
      <div className="faqs-container">
        {faqData.map((faq) => (
          <FaqItem
            key={faq.id}
            id={faq.id}
            question={faq.question}
            answer={faq.answer}
            isExpanded={!!expandedItems[faq.id]}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </section>
  );
}
  */
