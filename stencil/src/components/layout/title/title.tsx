/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Trust Center page title and support section

  - stencil is presentational only; react passes all business text/content
  - no hardcoded support copy or email defaults in stencil
  - optional support email subject prop keeps mailto formatting centralized here
  - conditional rendering avoids empty wrappers when props are omitted
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, h } from '@stencil/core';

@Component({
  tag: 'aon-title',
  styleUrl: './title.css',
  shadow: true
})
export class AonTitle {
  // ---------- public api ----------

  @Prop() trustCenterName: string = ''; // react should pass page title text
  @Prop() supportMessage: string = ''; // react should pass descriptive copy
  @Prop() supportEmail: string = ''; // react should pass support mailbox
  @Prop() supportEmailSubject: string = 'Trust-Center-Support'; // optional mailto subject

  // ---------- helpers ----------

  private getMailToHref(): string {
    const email = (this.supportEmail ?? '').trim();

    if (!email) return '';

    const subject = encodeURIComponent(
      (this.supportEmailSubject ?? '').trim() || 'Trust-Center-Support'
    );

    return `mailto:${email}?subject=${subject}`;
  }

  // ---------- render ----------

  render() {
    const title = (this.trustCenterName ?? '').trim();
    const message = (this.supportMessage ?? '').trim();
    const email = (this.supportEmail ?? '').trim();
    const mailTo = this.getMailToHref();

    if (!title && !message && !email) {
      return null;
    }

    return (
      <div class="title-section">
        {title && (
          <div class="name">
            <h1>{title}</h1>
          </div>
        )}

        {message && (
          <div class="support-message">
            <p>{message}</p>
          </div>
        )}

        {email && mailTo && (
          <div class="support-email">
            <a href={mailTo}>{email}</a>
          </div>
        )}
      </div>
    );
  }
}
