import type { Components, JSX } from "../types/components";

interface AonFooter extends Components.AonFooter, HTMLElement {}
export const AonFooter: {
    prototype: AonFooter;
    new (): AonFooter;
};
/**
 * Used to define this component and all nested components recursively.
 */
export const defineCustomElement: () => void;
