/* ================================
  TL;DR  -->  A card that shows control information in each row with a status on right side off the card
      1. There should be cards for the following:
        - Infrastructure Security
        - Organizational Security
        - Product Security
        - Internal Security Procedures
        - Data and Privacy
      2. Within each card should be the control information which consists of:
        - bold h1 text showing the control
        - regular h2 text going into more detail about that control
        - on the right side - the status should include a green check circle
================================ */

import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time


// Defines the <aon-control-card> Web Component
@Component({
  tag: 'aon-control-card', // registers the custom element <aon-control-card>
  styleUrls: ['./control-card.css'],
  shadow: true, // enables Shadow DOM for DOM and style encapsulation
})

 
export class ControlCard {

// Props needed - Title, Subtitle, Description, List items, Status, Green Dot 
  @Prop() controlCardTitle: string;
  @Prop() controlCardSubtitle: string[] = [];
  @Prop() controlCardSubtitleDescription: string[] = [];
  @Prop() controlStatusText: string;
  @Prop() greenDotIcon: string;

  render() {
    return (
      <div class="control-card">
        {/* Control Card Title */}
        {this.controlCardTitle && (
          <div class="control-card-title">
            <h1>{this.controlCardTitle}</h1>
          </div>
        )}
        {/* Control Card Subtitles */}
        {this.controlCardSubtitle.length > 0 && (
          <div class="control-card-subtitle">
            {this.controlCardSubtitle.map(subtitle => (
              <h2>{subtitle}</h2>
            ))}
          </div>
        )}
        {/* Control Card Subtitle Descriptions */}
        {this.controlCardSubtitleDescription.length > 0 && (
          <div class="control-card-subtitle-description">
            {this.controlCardSubtitleDescription.map(desc => (
              <p>{desc}</p>
            ))}
          </div>
        )}
        {/* Control Status Text */}
        {this.controlStatusText && (
          <div class="control-status-text">
            <p>{this.controlStatusText}</p>
          </div>
        )}
        {/* Green Dot Icon */}
        {this.greenDotIcon && (
          <div class="green-dot-icon">
            <img src={this.greenDotIcon} alt="green-dot-graphic" />
          </div>
        )}
      </div>
    );
  }
}