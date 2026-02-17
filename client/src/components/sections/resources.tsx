/* ================================
  TL;DR  --> Resources section that shows the following:
      1. Client Facing Documents and External Links - In the format of a linked card
================================ */

import React from 'react';
import PDF from '../../assets/images/pdf-svgrepo-com.svg';
import External from '../../assets/images/external-link-svgrepo-com.svg';


export default function Resources() {
  return (
    <section className="resources-section">
      <div className="resources-grid">

      
      <aon-link-card
        link-title="Client Facing Documents"
        items={JSON.stringify([
          { label: 'CyQu Privacy Policy', href: '#', iconSrc: PDF,
      iconAlt: 'PDF file' },
          { label: 'CyQu Penetration Test Reports', href: '#', iconSrc: PDF,
      iconAlt: 'PDF file' },
          { label: 'Aon: Client Privacy Summary', href: '#', iconSrc: PDF,
      iconAlt: 'PDF file' },
          {
            label: 'Aon: Cyber Security and Risk Management Overview',
            href: '#',
            iconSrc: PDF,
      iconAlt: 'PDF file'
          }
        ])}
      />

      <aon-link-card
        link-title="External Links"
        items={JSON.stringify([
          {
            label: 'Aon: Ensuring Ongoing Operations',
            href: '#',
            iconSrc: External,
      iconAlt: 'External link'
          },
          { label: 'Aon Secure', href: '#', icon: 'external' },
          {
            label: 'Aon’s Policies and Standards',
            href: '#',
            iconSrc: External,
      iconAlt: 'External link'
          },
          {
            label: 'Aon: Security - Submit Request',
            href: '#',
            iconSrc: External,
      iconAlt: 'External link'
          }
        ])}
      />
      </div>
      <div className="resources-callout">
       <aon-blue-card
        blue-card-title="Aon Trust Portal"
        blue-card-description="Direct access to widely consumed Aon enterprise controls and artifacts."
        blue-card-button-text="Visit Portal"
        blue-card-button-link="https://aonmt.tbs.aon.com/login?returnUrl=%2Fhome"
      /></div>
    </section>
  );
}
