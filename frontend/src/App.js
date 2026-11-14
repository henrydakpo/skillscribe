import React, { useState } from 'react';
import LandingGateway from './components/LandingGateway';
import './App.css';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5501';

function App() {
  const [user, setUser] = useState(null);
  const [inputContent, setInputContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const enterDashboard = (userData) => {
    setUser(userData);
    setInputContent(userData.initialContent || '');
    setResult(null);
    setError('');
  };

  const handleAnalyze = async (event) => {
    event.preventDefault();
    if (!inputContent.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze content.');
      }

      setResult(data.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <LandingGateway onEnterDashboard={enterDashboard} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header dashboard-header">
        <div>
          <h1>SkillScribe Dashboard</h1>
          <p>
            {user.isGuest ? (
              <>Guest session: <span>{user.email}</span></>
            ) : (
              <>Signed in as: <span>{user.email}</span></>
            )}
          </p>
        </div>
        <button
          className="sign-out-button"
          onClick={() => setUser(null)}
          type="button"
        >
          Sign Out
        </button>
      </header>

      <main className="dashboard">
        <form onSubmit={handleAnalyze} className="analysis-form">
          <div>
            <label htmlFor="input-content">
              Paste code, text, or a complex concept you want broken down:
            </label>
            <textarea
              id="input-content"
              rows="5"
              placeholder="e.g., Explain React useEffect cleanup functions or paste an asynchronous JavaScript snippet..."
              value={inputContent}
              onChange={(event) => setInputContent(event.target.value)}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Analyzing with Gemini...' : 'Generate Breakdown'}
          </button>
        </form>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {result && (
          <div className="results" aria-live="polite">
            <section className="analogy">
              <h2>The Analogy</h2>
              <p>{result.analogy}</p>
            </section>

            <section className="breakdown">
              <h2>Step-by-Step Breakdown</h2>
              <div className="steps">
                {result.breakdown_steps.map((step, idx) => (
                  <article className="step" key={idx}>
                    <h3>
                      Step {idx + 1}: {step.title}
                    </h3>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </section>

            {result.quiz && (
              <section className="quiz">
                <h2>Quick Comprehension Check</h2>
                <p className="quiz-question">{result.quiz.question}</p>
                <ul>
                  {result.quiz.options.map((option, idx) => (
                    <li key={idx}>{option}</li>
                  ))}
                </ul>
                <p className="correct-answer">
                  Correct Answer: {result.quiz.correct_answer}
                </p>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
