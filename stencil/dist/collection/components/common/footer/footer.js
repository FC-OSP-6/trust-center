import { h } from "@stencil/core";
export class FooterStencilComponent {
    render() {
        const { privacyPolicy, termsAndConditions, copyright } = this;
        return (h("footer", { key: '6f7a2d6e20aa26ce3aa8e391361c9cc8d8e649a2' }, h("div", { key: '0736fc68eb5e47e13a1474a38ccd2ed992cfaa78', class: "footer-content" }, h("div", { key: 'c8e2502bf8e070ef9b46229edaafff36f0b8429b', class: "footer-links" }, h("a", { key: '59f6daf706464c8e10b80acf0392fba1770c9df7', href: "/privacy-policy" }, privacyPolicy), h("a", { key: 'abf1c328481e071df2b7d44c0d2e901aa7a9f9ac', href: "/terms-and-conditions" }, termsAndConditions)), h("div", { key: '0e70c8ec56ffd766ed805ae93025206bf303a976', class: "footer-copyright" }, h("p", { key: 'd22fff4406775214874df452fd985a9bf14e7a4d' }, copyright)))));
    }
    static get is() { return "aon-footer"; }
    static get encapsulation() { return "shadow"; }
    static get originalStyleUrls() {
        return {
            "$": ["./footer.css"]
        };
    }
    static get styleUrls() {
        return {
            "$": ["footer.css"]
        };
    }
    static get properties() {
        return {
            "privacyPolicy": {
                "type": "string",
                "mutable": false,
                "complexType": {
                    "original": "string",
                    "resolved": "string",
                    "references": {}
                },
                "required": true,
                "optional": false,
                "docs": {
                    "tags": [],
                    "text": ""
                },
                "getter": false,
                "setter": false,
                "reflect": false,
                "attribute": "privacy-policy"
            },
            "termsAndConditions": {
                "type": "string",
                "mutable": false,
                "complexType": {
                    "original": "string",
                    "resolved": "string",
                    "references": {}
                },
                "required": true,
                "optional": false,
                "docs": {
                    "tags": [],
                    "text": ""
                },
                "getter": false,
                "setter": false,
                "reflect": false,
                "attribute": "terms-and-conditions"
            },
            "copyright": {
                "type": "string",
                "mutable": false,
                "complexType": {
                    "original": "string",
                    "resolved": "string",
                    "references": {}
                },
                "required": true,
                "optional": false,
                "docs": {
                    "tags": [],
                    "text": ""
                },
                "getter": false,
                "setter": false,
                "reflect": false,
                "attribute": "copyright"
            }
        };
    }
}
