import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders the SkillScribe gateway and authentication form', () => {
  render(<App />);

  expect(
    screen.getByRole('heading', { name: /master complex code & concepts/i })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/credentials are sent to the skillscribe api/i)
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
  ).toHaveTextContent(/guest session: guest user/i);
});

test('creates an account through the API and keeps its token in memory', async () => {
  localStorage.clear();
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      token: 'test.jwt.token',
      user: { id: '42', email: 'learner@example.com' },
    }),
  });

  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'learner@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'a-secure-test-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account & start/i }));

  await waitFor(() => {
    expect(
      screen.getByRole('heading', { name: /skillscribe dashboard/i })
    ).toBeInTheDocument();
  });
  expect(screen.getByRole('banner')).toHaveTextContent(
    /signed in as: learner@example\.com/i
  );
  expect(fetchSpy).toHaveBeenCalledWith(
    `${process.env.REACT_APP_API_URL || 'http://localhost:5501'}/api/auth/signup`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'learner@example.com',
        password: 'a-secure-test-password',
      }),
    })
  );
  expect(localStorage.getItem('skillscribe_token')).toBeNull();
  fetchSpy.mockRestore();
});

test('shows authentication API errors without leaving the gateway', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Invalid email or password.' }),
  });

  render(<App />);
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'learner@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'incorrect-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: /access dashboard/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid email or password.'
  );
  expect(
    screen.getByRole('heading', { name: /master complex code & concepts/i })
  ).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledWith(
    `${process.env.REACT_APP_API_URL || 'http://localhost:5501'}/api/auth/signin`,
    expect.objectContaining({ method: 'POST' })
  );
  fetchSpy.mockRestore();
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
