import { newSpecPage } from '@stencil/core/testing';
import { FaqCard } from '../src/components/faq/faq-card';

const faqsConnection = {
  edges: [
    {
      cursor: '1',
      node: {
        id: 'faq-1',
        faqKey: 'auth-1',
        question: 'How does CyQu manage authentication within access control?',
        answer: 'CyQu uses role-based access with periodic review.',
        category: 'Access Control',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      cursor: '2',
      node: {
        id: 'faq-2',
        faqKey: 'privacy-1',
        question: 'How is sensitive client data protected?',
        answer: 'Sensitive data is encrypted in transit and at rest.',
        category: 'Privacy',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    }
  ],
  pageInfo: {
    hasNextPage: false,
    endCursor: '2'
  },
  totalCount: 2
};

describe('aon-faq-card', () => {
  it('renders grouped faq mode from faqs-json', async () => {
    const page = await newSpecPage({
      components: [FaqCard],
      html: `<aon-faq-card data-mode="faqs" faqs-json='${JSON.stringify(faqsConnection)}'></aon-faq-card>`
    });

    expect(page.root?.shadowRoot?.textContent).toContain('Access Control');
    expect(page.root?.shadowRoot?.textContent).toContain(
      'How does CyQu manage authentication within access control?'
    );
  });

  it('renders loading and empty states in faq mode', async () => {
    const loadingPage = await newSpecPage({
      components: [FaqCard],
      html: '<aon-faq-card data-mode="faqs" is-loading="true"></aon-faq-card>'
    });

    expect(loadingPage.root?.shadowRoot?.textContent).toContain(
      'loading faqs...'
    );

    const emptyPage = await newSpecPage({
      components: [FaqCard],
      html: '<aon-faq-card data-mode="faqs"></aon-faq-card>'
    });

    expect(emptyPage.root?.shadowRoot?.textContent).toContain('no faqs found');
  });

  it('expands answer content in single faq mode', async () => {
    const page = await newSpecPage({
      components: [FaqCard],
      html: '<aon-faq-card data-mode="single" question="What is CyQu?" answer="A cybersecurity evaluation service."></aon-faq-card>'
    });

    const button = page.root?.shadowRoot?.querySelector(
      '.row-header'
    ) as HTMLButtonElement | null;
    const revealWrap = page.root?.shadowRoot?.querySelector(
      '.aon-reveal-wrap'
    ) as HTMLElement | null;

    button?.click();
    await page.waitForChanges();

    expect(revealWrap?.className).toContain('is-open');
    expect(page.root?.shadowRoot?.textContent).toContain(
      'A cybersecurity evaluation service.'
    );
  });

  it('renders external error text in faq mode', async () => {
    const page = await newSpecPage({
      components: [FaqCard],
      html: '<aon-faq-card data-mode="faqs" error-text="Categories unavailable."></aon-faq-card>'
    });

    const alert = page.root?.shadowRoot?.querySelector('[role="alert"]');

    expect(alert?.textContent).toContain('error: Categories unavailable.');
  });
});
