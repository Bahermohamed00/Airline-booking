import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SearchCard } from './search-card.component';

describe('SearchCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('clamps the return date when departure moves past it', async () => {
    const fixture = TestBed.createComponent(SearchCard);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const depart = el.querySelector<HTMLInputElement>('#hs-depart')!;
    const returnInput = el.querySelector<HTMLInputElement>('#hs-return')!;
    const before = returnInput.value;

    depart.value = '2099-06-15';
    depart.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(before).not.toBe('2099-06-15');
    expect(returnInput.value).toBe('2099-06-15');
  });

  it('shows an error when no destination is selected', async () => {
    const fixture = TestBed.createComponent(SearchCard);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(el.querySelector('.card__error')?.textContent).toContain('origin and a destination');
  });
});
