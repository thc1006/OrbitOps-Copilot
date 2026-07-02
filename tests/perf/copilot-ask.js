import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    constant_5rps: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: {
    // Measured baseline 2026-07-02: p(95)=3.39ms, p(99)=6.75ms (JWT_REQUIRED=false, FakeLLMProvider)
    // Thresholds set at 2× measured value to catch regressions of 2× or worse.
    http_req_duration: ['p(95)<7', 'p(99)<15'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE = __ENV.COPILOT_BASE || 'http://localhost:30081';

const PAYLOAD = JSON.stringify({
  question: 'What is the beam SNR status for beam-1?',
  scenario_id: 'perf-test',
});

export default function () {
  const res = http.post(`${BASE}/ask`, PAYLOAD, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
  });
}
