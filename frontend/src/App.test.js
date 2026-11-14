import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders the SkillScribe gateway and demo authentication notice', () => {
  render(<App />);

  expect(
    screen.getByRole('heading', { name: /master complex code & concepts/i })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/authentication is not connected/i)
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /continue as guest/i })
  ).toBeInTheDocument();
});

test('passes guest-entered text into the analysis dashboard', () => {
  render(<App />);

  const guestInput = screen.getByRole('textbox', {
    name: /code or concept to explore as a guest/i,
  });
  fireEvent.change(guestInput, { target: { value: 'Explain closures' } });
  fireEvent.click(screen.getByRole('button', { name: /launch app/i }));

  expect(
    screen.getByRole('heading', { name: /skillscribe dashboard/i })
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText(/paste code, text, or a complex concept/i)
  ).toHaveValue('Explain closures');
  expect(
    screen.getByRole('banner')
  ).toHaveTextContent(/demo session: guest user \(guest\)/i);
});

test('sends analysis requests to the configured API base URL', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      data: { analogy: 'A helpful comparison', breakdown_steps: [], quiz: null },
    }),
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));
  fireEvent.change(
    screen.getByLabelText(/paste code, text, or a complex concept/i),
    { target: { value: 'Explain closures' } }
  );
  fireEvent.click(screen.getByRole('button', { name: /generate breakdown/i }));

  await waitFor(() => {
    expect(fetchSpy).toHaveBeenCalledWith(
      `${process.env.REACT_APP_API_URL || 'http://localhost:5501'}/api/analyze`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  fetchSpy.mockRestore();
});
