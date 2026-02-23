/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Site-level footer 

  - stencil renders only; react passes legal text + link labels + hrefs
  - removes dead shadow query code and unused @Element reference
  - conditional rendering avoids broken anchors/images when props are absent
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, h, Fragment } from '@stencil/core';

@Component({
  tag: 'aon-footer',
  styleUrl: 'footer.css',
  shadow: true
})
export class AonFooter {
  // ---------- public api ----------

  @Prop() logoSrc: string = ''; // optional brand logo url
  @Prop() logoAlt: string = 'Company logo'; // optional accessible alt text

  @Prop() privacyPolicyHref: string = ''; // optional legal link href
  @Prop() privacyPolicyLabel: string = ''; // optional legal link label

  @Prop() termsHref: string = ''; // optional legal link href
  @Prop() termsLabel: string = ''; // optional legal link label

  @Prop() copyright: string = ''; // react passes final legal text

  // ---------- render ----------

  render() {
    const logoSrc = (this.logoSrc ?? '').trim();
    const logoAlt = (this.logoAlt ?? '').trim() || 'Company logo';

    const privacyHref = (this.privacyPolicyHref ?? '').trim();
    const privacyLabel = (this.privacyPolicyLabel ?? '').trim();

    const termsHref = (this.termsHref ?? '').trim();
    const termsLabel = (this.termsLabel ?? '').trim();

    const copyright = (this.copyright ?? '').trim();

    const hasLeftContent =
      !!logoSrc ||
      (!!privacyHref && !!privacyLabel) ||
      (!!termsHref && !!termsLabel);

    const hasRightContent = !!copyright;

    if (!hasLeftContent && !hasRightContent) {
      return null;
    }

    return (
      <footer role="contentinfo">
        <div class="footer-content">
          <div class="footer-left">
            {logoSrc && <img src={logoSrc} alt={logoAlt} />}

            <div class="footer-links">
              {privacyHref && privacyLabel && (
                <a href={privacyHref}>{privacyLabel}</a>
              )}

              {termsHref && termsLabel && <a href={termsHref}>{termsLabel}</a>}
            </div>
          </div>

          <div class="footer-right">
            {copyright && (
              <Fragment>
                <span class="copyright-symbol">©</span>
                <span class="footer-copyright">{copyright}</span>
              </Fragment>
            )}
          </div>
        </div>
      </footer>
    );
  }
}
