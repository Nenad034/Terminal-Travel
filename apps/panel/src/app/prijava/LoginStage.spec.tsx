import { act, render, screen } from '@testing-library/react';
import LoginStage, { type LoginSlide } from './LoginStage';

// Dizajn dok. 29 §6i / M17 §3.0 — put sa fotografijama iz kataloga: dev baza (17.9.2026) nema
// nijednu sliku, pa se smena slika uživo nije mogla videti; ovde se dokazuje sa tri lažne.
jest.mock('./login-scene', () => ({ paintFallbackScene: jest.fn() }));

const slides: LoginSlide[] = [
  {
    imageUrl: '/a.jpg',
    place: 'Kasandra',
    country: 'Grčka',
    productName: 'Aegean Breeze Resort 4*',
    geo: '40.0192° N · 23.4109° E',
    note: null,
  },
  {
    imageUrl: '/b.jpg',
    place: 'Kotor',
    country: 'Crna Gora',
    productName: 'Kotor Old Town Rooms 3*',
    geo: null,
    note: 'Zaliv koji planina drži u šaci.',
  },
  {
    imageUrl: '/c.jpg',
    place: 'Rodos',
    country: 'Grčka',
    productName: 'Rhodes Sun Village 5*',
    geo: null,
    note: null,
  },
];

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

describe('LoginStage (§6i)', () => {
  it('sa tri slike: sve tri su u DOM-u, prva vidljiva, blok „Iz kataloga" prati prvu; posle 8 s prelazi na drugu', () => {
    jest.useFakeTimers();
    render(
      <LoginStage slides={slides} version="0.1.0">
        <div>forma</div>
      </LoginStage>,
    );
    const photos = document.querySelectorAll('img.photo');
    expect(photos).toHaveLength(3);
    expect(photos[0].classList.contains('on')).toBe(true);
    expect(photos[1].classList.contains('on')).toBe(false);
    expect(screen.getByText('Kasandra')).toBeInTheDocument();
    expect(screen.getByText('01 / 03')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(8000 + 600);
    });
    expect(document.querySelectorAll('img.photo')[1].classList.contains('on')).toBe(true);
    expect(screen.getByText('Kotor')).toBeInTheDocument();
    expect(screen.getByText('Zaliv koji planina drži u šaci.')).toBeInTheDocument();
    expect(screen.getByText('02 / 03')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('bez ijedne slike: canvas rezerva, nema bloka „Iz kataloga", podnožje nosi verziju', () => {
    render(
      <LoginStage slides={[]} version="0.1.0">
        <div>forma</div>
      </LoginStage>,
    );
    expect(document.querySelector('canvas.scene')).not.toBeNull();
    expect(document.querySelectorAll('img.photo')).toHaveLength(0);
    expect(screen.queryByText(/iz kataloga/i)).toBeNull();
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
  });
});
