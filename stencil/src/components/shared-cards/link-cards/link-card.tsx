/* ======================================================
  TL;DR → Link list card

  Responsibilities:
  - Render a titled card containing navigational links
  - Display links in a clear, scannable list format
  - Support truncated list display with optional host-controlled expansion
  - Act as a presentational shell for broker/client navigation

  Data contract:
  - `title`: string displayed as the card heading
  - `links`: ordered list of navigation objects:
      {
        label: string; // visible link text
        href: string;  // destination URL
      }
====================================================== */

import { Component, Prop, h } from '@stencil/core';

@Component({
  tag: 'aon-link-card',
  styleUrl: 'link-card.css',
  shadow: true
})
export class LinkCard {
  /** Card heading */
  @Prop() linkCardTitle!: string;

  /** Link 1 */
  @Prop() linkOneLabel!: string;
  @Prop() linkOneHref!: string;

  /** Link 2 */
  @Prop() linkTwoLabel!: string;
  @Prop() linkTwoHref!: string;

  /** Link 3 */
  @Prop() linkThreeLabel!: string;
  @Prop() linkThreeHref!: string;

  /** Link 4 */
  @Prop() linkFourLabel!: string;
  @Prop() linkFourHref!: string;

  render() {
    const {
      linkCardTitle,
      linkOneLabel,
      linkOneHref,
      linkTwoLabel,
      linkTwoHref,
      linkThreeLabel,
<<<<<<< HEAD
      linkThreeHref,
      linkFourLabel, 
      linkFourHref
=======
      linkThreeHref
>>>>>>> main
    } = this;

    return (
      <div class="link-card">
<<<<<<< HEAD
        <h1 class="title"><p>{linkCardTitle}</p></h1>

        <ul class="link-list">
          <li class="link-item">
            <a href={linkOneHref}><p>{linkOneLabel}</p></a>
          </li>

          <li class="link-item">
            <a href={linkTwoHref}><p>{linkTwoLabel}</p></a>
          </li>

          <li class="link-item">
            <a href={linkThreeHref}><p>{linkThreeLabel}</p></a>
          </li>

          <li class="link-item">
            <a href={linkFourHref}><p>{linkFourLabel}</p></a>
=======
        <h1>{linkCardTitle}</h1>

        <ul class="link-list">
          <li class="link-item">
            <a href={linkOneHref}>{linkOneLabel}</a>
          </li>

          <li class="link-item">
            <a href={linkTwoHref}>{linkTwoLabel}</a>
          </li>

          <li class="link-item">
            <a href={linkThreeHref}>{linkThreeLabel}</a>
>>>>>>> main
          </li>
        </ul>
      </div>
    );
  }
}

// import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// // `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time

// @Component({
//   tag: 'link-card',
//   styleUrl: 'link-card.css',
//   shadow: true, // isolate DOM + styles for design-system safety
// })
// export class LinkCard {
//   // ---- Public API (controlled by host application) ----

//   /** Display title for the card */
//   @Prop() linkCardTitle!: string;

//   /** Ordered list of navigation links */
//   @Prop() links!: Array<{ label: string; href: string }> = [];

//   // ---- Render ----
//   // Renders a capped preview of links; expansion handled externally

//   render() {
//     const { linkCardTitle, links } = this;

//     // Limit visible links to initial preview count
//     const visibleLinks = links.slice(0, 4);

//     // Calculate overflow indicator count (if any)
//     const hiddenCount = links.length - visibleLinks.length;

//     return (
//       <div class="link-card">
//         <h1>{linkCardTitle}</h1>

//         <ul class="link-list">
//           {visibleLinks.map(({ label, href }, index) => (
//             <li class="link-item" key={index}>
//               <a href={href}>
//                 {label}
//               </a>
//             </li>
//           ))}

//           {/* Overflow indicator shown when additional links exist */}
//           {hiddenCount > 0 && (
//             <li class="link-item more-indicator">
//               +{hiddenCount} more
//             </li>
//           )}
//         </ul>
//       </div>
//     );
//   }
// }

// Example for what needs to happen in react:

// {/* <link-card
//   title="Related Resources"
//   links={[
//     { label: 'SOC 2 Report', href: '/docs/soc2' },
//     { label: 'Data Retention Policy', href: '/policies/data-retention' },
//     { label: 'Security Overview', href: '/security' },
//   ]}
// /> */}
