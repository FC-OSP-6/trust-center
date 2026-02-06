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
      
      <faq-card
        question={`Unde omnis iste natus error sit voluptatem accusantium doloremque?`}
        answer={`Ctetur, adipisci velit, sed quia non numquam eius modi tempora incidunt.`}
        onToggleFaq={() => setExpanded(prev => !prev)}
        expanded={expanded}
      />

      <faq-card
        question={`Maecenas consectetur, tellus quis tempor convallis, tellus ante molestie purus, vel rhoncus elit diam eleifend tortor?`}
        answer={`Vestibulum ut elit. In quis faucibus ex, tristique aliquam augue. Nulla facilisi. Nunc est risus, sodales non mi ut, lobortis mollis mauris. Quisque efficitur euismod ipsum consequat congue.`}
        onToggleFaq={() => setExpanded(prev => !prev)}
        expanded={expanded}
      />

      <faq-card
        question={`Nunc lobortis tempor ullamcorper. Donec luctus finibus tellus, tempus pretium nisi laoreet eu?`}
        answer={`Etiam placerat condimentum faucibus. Praesent porta suscipit pulvinar. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Nunc pellentesque eget nibh ut mattis. Sed sem sapien, congue a vehicula eu, tincidunt quis risus. Pellentesque id mauris sit amet dolor tristique porta ut sed tellus.`}
        onToggleFaq={() => setExpanded(prev => !prev)}
        expanded={expanded}
      />

      <faq-card
        question={`Proin non bibendum arcu. Curabitur dolor ligula, blandit vel ornare eget, euismod id metus?`}
        answer={`Vestibulum metus lorem, interdum in consectetur non, blandit gravida sapien. Nunc maximus interdum nisl, vulputate aliquet felis sagittis et. Duis vitae auctor velit. Integer tristique blandit diam, ut viverra nibh lobortis eu.`}
        onToggleFaq={() => setExpanded(prev => !prev)}
        expanded={expanded}
      />

      <faq-card
        question={`Duis luctus vel odio ut efficitur. Duis eu porttitor mauris, et consequat lorem?`}
        answer={`Pellentesque ultricies et nunc ut interdum. Nunc tincidunt facilisis sodales. Vestibulum consequat consectetur tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin nec elit a ligula euismod pretium id eu nulla. Fusce lacinia convallis consectetur.`}
        onToggleFaq={() => setExpanded(prev => !prev)}
        expanded={expanded}
      />
    </section>
  );
}