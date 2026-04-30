import { newSpecPage } from '@stencil/core/testing';
import { AonSubnavCard } from '../src/components/control/subnav-card';

describe('aon-subnav-card', () => {
  it('renders parsed navigation links from items-json', async () => {
    const page = await newSpecPage({
      components: [AonSubnavCard],
      html: '<aon-subnav-card items-json="[{&quot;label&quot;:&quot;Access Control&quot;,&quot;href&quot;:&quot;#controls-category-access-control&quot;}]"></aon-subnav-card>'
    });

    const link = page.root?.shadowRoot?.querySelector('a');

    expect(link?.textContent).toContain('Access Control');
    expect(link?.getAttribute('href')).toBe(
      '#controls-category-access-control'
    );
  });

  it('renders empty text when no items are available', async () => {
    const page = await newSpecPage({
      components: [AonSubnavCard],
      html: '<aon-subnav-card empty-text="Categories unavailable."></aon-subnav-card>'
    });

    expect(page.root?.shadowRoot?.textContent).toContain(
      'Categories unavailable.'
    );
  });

  it('emits aonSubnavJump for hash links', async () => {
    const page = await newSpecPage({
      components: [AonSubnavCard],
      html: '<aon-subnav-card items-json="[{&quot;label&quot;:&quot;Access Control&quot;,&quot;href&quot;:&quot;#controls-category-access-control&quot;}]"></aon-subnav-card>'
    });

    const onJump = jest.fn();
    page.root?.addEventListener('aonSubnavJump', onJump);

    const link = page.root?.shadowRoot?.querySelector('a') as HTMLAnchorElement;
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0
    });

    link.dispatchEvent(clickEvent);
    await page.waitForChanges();

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump.mock.calls[0]?.[0]?.detail).toEqual({
      href: '#controls-category-access-control',
      id: 'controls-category-access-control'
    });
  });

  it('does not emit aonSubnavJump for full links', async () => {
    const page = await newSpecPage({
      components: [AonSubnavCard],
      html: '<aon-subnav-card items-json="[{&quot;label&quot;:&quot;Portal&quot;,&quot;href&quot;:&quot;https://example.com&quot;}]"></aon-subnav-card>'
    });

    const onJump = jest.fn();
    page.root?.addEventListener('aonSubnavJump', onJump);

    const link = page.root?.shadowRoot?.querySelector('a') as HTMLAnchorElement;
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0
    });

    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
    expect(onJump).not.toHaveBeenCalled();
  });
});
