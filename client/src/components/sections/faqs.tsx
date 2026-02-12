/* ================================
  TL;DR  --> A button that when clicked expands to FAQs in the form of separate dropdowns for each question 
      1. Each FAQ will have a button that will expand or shrink to show the answer to that question
================================ */
// import React from "react";

//On the client side

import { useState } from 'react';


export default function Faqs() {

  //this line should not exist
  const [expanded, setExpanded] = useState(false);
  //const [expanded, setExpanded] = useState({})

  //Handle Toggle

  return (
    <section>
      <faq-card question="Do you feel secure?" answer="Lorem ipsum dolor sit amet"/>
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
        <span className={`arrow ${isExpanded ? 'expanded' : ''}`}>
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