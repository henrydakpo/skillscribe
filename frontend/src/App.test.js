import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders the SkillScribe analysis form', () => {
  render(<App />);

  expect(
    screen.getByRole('heading', { name: /skillscribe/i })
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText(/paste code, text, or a complex concept/i)
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /generate breakdown/i })
  ).toBeInTheDocument();
});

test('sends analysis requests to the configured API base URL', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: { analogy: 'A helpful comparison', breakdown_steps: [], quiz: null },
    }),
  });

  render(<App />);
  fireEvent.change(
    screen.getByLabelText(/paste code, text, or a complex concept/i),
    { target: { value: 'Explain closures' } }
  );
  fireEvent.click(screen.getByRole('button', { name: /generate breakdown/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      `${process.env.REACT_APP_API_URL || 'http://localhost:5501'}/api/analyze`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  global.fetch = originalFetch;
});
