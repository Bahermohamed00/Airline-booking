import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home.component';

describe('HomePage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders every landing page section', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    for (const selector of [
      'na-home-navbar',
      'na-hero',
      'na-search-card',
      'na-destinations',
      'na-benefits',
      'na-offers',
      'na-experience',
      'na-testimonials',
      'na-cta-banner',
      'na-home-footer',
    ]) {
      expect(el.querySelector(selector), selector).not.toBeNull();
    }
  });

  it('exposes anchor targets for navigation', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    for (const id of ['top', 'book', 'destinations', 'offers', 'experience', 'reviews']) {
      expect(el.querySelector(`#${id}`), `#${id}`).not.toBeNull();
    }
  });

  it('renders search card fields and destination cards', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#hs-from')).not.toBeNull();
    expect(el.querySelector('#hs-to')).not.toBeNull();
    expect(el.querySelector('#hs-depart')).not.toBeNull();
    expect(el.querySelector('#hs-pax')).not.toBeNull();
    expect(el.querySelectorAll('na-destinations a.card').length).toBeGreaterThan(0);
  });
});
