export interface Destination {
  code: string;
  city: string;
  country: string;
  tagline: string;
  priceFrom: number;
  image: string;
}

export interface Benefit {
  icon: 'shield' | 'crown' | 'clock' | 'support';
  title: string;
  description: string;
}

export interface Offer {
  badge: string;
  origin: string;
  destination: string;
  routeLabel: string;
  title: string;
  description: string;
  cabin: string;
  price: number;
  oldPrice: number;
  featured: boolean;
  image?: string;
}

export interface Testimonial {
  name: string;
  route: string;
  rating: number;
  quote: string;
}

export interface FooterLink {
  label: string;
  path: string;
}

export interface FooterLinkGroup {
  heading: string;
  links: FooterLink[];
}
